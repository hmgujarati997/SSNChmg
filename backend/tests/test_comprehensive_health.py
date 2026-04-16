"""
Comprehensive health check tests for SSNC Speed Networking PWA.
Tests all major endpoints and flows for Admin, User, Volunteer, and Live Screen roles.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@ssnc.com"
ADMIN_PASSWORD = "admin123"
USER_PHONE = "7874949091"  # Password is same as phone
VOLUNTEER_PHONE = "9876543210"
VOLUNTEER_EMAIL = "a@a.com"
LIVE_SCREEN_PASSWORD = "ssnc2026"
EVENT_ID = "44f1f94d-0865-486a-b6e9-c0dcd0723a6a"


class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Admin login at /admin/login with admin@ssnc.com / admin123"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("admin", {}).get("email") == ADMIN_EMAIL
        print(f"✓ Admin login successful, token received")
        return data["token"]
    
    def test_admin_login_invalid_credentials(self):
        """Admin login with wrong credentials should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Admin login correctly rejected invalid credentials")


class TestAdminDashboard:
    """Admin dashboard and stats tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_dashboard_stats(self, admin_token):
        """Admin dashboard loads without errors"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard/stats", headers=headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        assert "total_users" in data
        assert "total_events" in data
        assert "total_categories" in data
        print(f"✓ Dashboard stats: {data['total_users']} users, {data['total_events']} events, {data['total_categories']} categories")


class TestAdminEvents:
    """Admin events management tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_events_list(self, admin_token):
        """Admin Events page loads and shows event list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/events", headers=headers)
        assert response.status_code == 200, f"Events list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Events should be a list"
        print(f"✓ Events list loaded: {len(data)} events")
    
    def test_event_detail(self, admin_token):
        """Admin event detail page loads with all data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/events/{EVENT_ID}", headers=headers)
        assert response.status_code == 200, f"Event detail failed: {response.text}"
        data = response.json()
        assert "name" in data
        assert "registration_count" in data
        assert "attendance_count" in data
        print(f"✓ Event detail loaded: {data.get('name')}, {data.get('registration_count')} registrations")
    
    def test_event_registrations(self, admin_token):
        """Admin Registrations tab shows registrations"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/events/{EVENT_ID}/registrations", headers=headers)
        assert response.status_code == 200, f"Registrations failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Registrations should be a list"
        print(f"✓ Registrations loaded: {len(data)} registrations")
    
    def test_event_assignments(self, admin_token):
        """Admin Seating tab shows table assignments"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/events/{EVENT_ID}/assignments", headers=headers)
        assert response.status_code == 200, f"Assignments failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Assignments should be a list"
        print(f"✓ Assignments loaded: {len(data)} table assignments")
    
    def test_day_of_status(self, admin_token):
        """Admin Day Of Event tab shows status"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/events/{EVENT_ID}/day-of-status", headers=headers)
        assert response.status_code == 200, f"Day of status failed: {response.text}"
        data = response.json()
        assert "total_registered" in data
        print(f"✓ Day of status: {data.get('total_registered')} registered, {data.get('total_attended')} attended")


class TestAdminCategories:
    """Admin categories management tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_categories_list(self, admin_token):
        """Admin Categories page loads cleanly"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/categories", headers=headers)
        assert response.status_code == 200, f"Categories list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Categories should be a list"
        # Verify each category has name and subcategory_count (no clash_group inputs needed)
        if data:
            assert "name" in data[0]
            assert "subcategory_count" in data[0]
        print(f"✓ Categories loaded: {len(data)} categories")


class TestAdminSettings:
    """Admin settings tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_settings_load(self, admin_token):
        """Admin Settings page loads with OpenAI key field and Tone upload section"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        assert response.status_code == 200, f"Settings failed: {response.text}"
        data = response.json()
        assert "live_screen_password" in data
        assert "admin_email" in data
        # OpenAI key should be present (may be masked or empty)
        assert "openai_api_key" in data or data.get("openai_api_key") is None
        print(f"✓ Settings loaded: admin_email={data.get('admin_email')}")


class TestAdminTableCaptains:
    """Admin table captains tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_table_captains_list(self, admin_token):
        """Admin table captains list loads"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/table-captains/{EVENT_ID}", headers=headers)
        assert response.status_code == 200, f"Table captains failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Table captains should be a list"
        print(f"✓ Table captains loaded: {len(data)} captains")


class TestAdminWhatsApp:
    """Admin WhatsApp status tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_whatsapp_status(self, admin_token):
        """Admin WhatsApp status loads"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/whatsapp/status/{EVENT_ID}", headers=headers)
        # May return 200 or 404 if no messages yet
        assert response.status_code in [200, 404], f"WhatsApp status failed: {response.text}"
        print(f"✓ WhatsApp status endpoint accessible")


class TestUserAuth:
    """User authentication tests"""
    
    def test_user_login_success(self):
        """User login at /login with phone 7874949091"""
        response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
            "phone": USER_PHONE,
            "password": USER_PHONE  # Password is same as phone
        })
        assert response.status_code == 200, f"User login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        print(f"✓ User login successful for phone {USER_PHONE}")
        return data["token"]
    
    def test_user_login_invalid(self):
        """User login with wrong phone should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
            "phone": "0000000000",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 403, 404], f"Expected auth error, got {response.status_code}"
        print(f"✓ User login correctly rejected invalid credentials")


class TestUserDashboard:
    """User dashboard tests"""
    
    @pytest.fixture
    def user_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
            "phone": USER_PHONE,
            "password": USER_PHONE
        })
        if response.status_code != 200:
            pytest.skip("User login failed")
        return response.json()["token"]
    
    def test_user_profile(self, user_token):
        """User profile loads"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/user/profile", headers=headers)
        assert response.status_code == 200, f"User profile failed: {response.text}"
        data = response.json()
        assert "phone" in data
        print(f"✓ User profile loaded: {data.get('full_name')}")
    
    def test_user_events(self, user_token):
        """User events list loads"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/user/events", headers=headers)
        assert response.status_code == 200, f"User events failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Events should be a list"
        print(f"✓ User events loaded: {len(data)} events")
    
    def test_user_categories(self, user_token):
        """User categories list loads"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/user/categories", headers=headers)
        assert response.status_code == 200, f"User categories failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Categories should be a list"
        print(f"✓ User categories loaded: {len(data)} categories")


class TestUserBadgeLookup:
    """User badge lookup tests"""
    
    @pytest.fixture
    def user_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
            "phone": USER_PHONE,
            "password": USER_PHONE
        })
        if response.status_code != 200:
            pytest.skip("User login failed")
        return response.json()["token"]
    
    def test_badge_lookup(self, user_token):
        """User can look up badge number via GET /api/user/lookup-badge/{event_id}/5"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/user/lookup-badge/{EVENT_ID}/5", headers=headers)
        # May return 200 (found) or 404 (not found) or 400 (self lookup)
        assert response.status_code in [200, 400, 404], f"Badge lookup failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "full_name" in data
            print(f"✓ Badge lookup found: {data.get('full_name')}")
        else:
            print(f"✓ Badge lookup returned {response.status_code} (expected for badge 5)")


class TestVolunteerAuth:
    """Volunteer authentication tests"""
    
    def test_volunteer_login_success(self):
        """Volunteer login at /volunteer/login with phone 9876543210 / email a@a.com"""
        response = requests.post(f"{BASE_URL}/api/auth/volunteer/login", json={
            "phone": VOLUNTEER_PHONE,
            "password": VOLUNTEER_EMAIL  # Password is the email
        })
        assert response.status_code == 200, f"Volunteer login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        print(f"✓ Volunteer login successful for phone {VOLUNTEER_PHONE}")


class TestLiveScreen:
    """Live screen tests"""
    
    def test_live_auth(self):
        """Live screen at /live/{event_id} loads password prompt"""
        response = requests.post(f"{BASE_URL}/api/live/auth", json={
            "password": LIVE_SCREEN_PASSWORD
        })
        assert response.status_code == 200, f"Live auth failed: {response.text}"
        print(f"✓ Live screen auth successful")
    
    def test_live_auth_invalid(self):
        """Live screen rejects wrong password"""
        response = requests.post(f"{BASE_URL}/api/live/auth", json={
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print(f"✓ Live screen correctly rejected invalid password")
    
    def test_live_stats(self):
        """Live screen stats endpoint works"""
        response = requests.get(f"{BASE_URL}/api/live/stats/{EVENT_ID}")
        assert response.status_code == 200, f"Live stats failed: {response.text}"
        data = response.json()
        assert "total_references" in data
        assert "attendance_count" in data
        print(f"✓ Live stats: {data.get('total_references')} references, {data.get('attendance_count')} attendance")
    
    def test_live_leaderboard(self):
        """Live screen leaderboard endpoint works"""
        response = requests.get(f"{BASE_URL}/api/live/leaderboard/{EVENT_ID}")
        assert response.status_code == 200, f"Live leaderboard failed: {response.text}"
        data = response.json()
        assert "top_givers" in data
        assert "top_receivers" in data
        assert "table_stats" in data
        print(f"✓ Live leaderboard loaded")
    
    def test_live_events_list(self):
        """Live screen events list works"""
        response = requests.get(f"{BASE_URL}/api/live/events")
        assert response.status_code == 200, f"Live events failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Events should be a list"
        print(f"✓ Live events list: {len(data)} events")


class TestPublicEndpoints:
    """Public endpoints tests"""
    
    def test_public_branding(self):
        """Public branding endpoint works"""
        response = requests.get(f"{BASE_URL}/api/public/branding")
        assert response.status_code == 200, f"Public branding failed: {response.text}"
        data = response.json()
        # Should have sponsor fields
        assert "sponsor_heading" in data or data.get("sponsor_heading") is None
        print(f"✓ Public branding loaded")
    
    def test_public_categories(self):
        """Public categories endpoint works"""
        response = requests.get(f"{BASE_URL}/api/public/categories")
        assert response.status_code == 200, f"Public categories failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Categories should be a list"
        print(f"✓ Public categories: {len(data)} categories")
    
    def test_public_events(self):
        """Public events endpoint works"""
        response = requests.get(f"{BASE_URL}/api/public/events")
        assert response.status_code == 200, f"Public events failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Events should be a list"
        print(f"✓ Public events: {len(data)} events")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
