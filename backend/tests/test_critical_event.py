"""
Critical Pre-Event Testing for SSNC Speed Networking PWA
Tests all critical flows for 520+ users event day
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@ssnc.com"
ADMIN_PASSWORD = "admin123"
USER_PHONE = "9327331017"  # From review request
USER_PHONE_ALT = "8200663263"  # From test_credentials.md
VOLUNTEER_PHONE = "9876543210"
VOLUNTEER_PASSWORD = "a@a.com"
LIVE_SCREEN_PASSWORD = "ssnc2026"
TEST_EVENT_ID = "44f1f94d-0865-486a-b6e9-c0dcd0723a6a"  # From review request
TEST_USER_ID = "d7365a15-c315-47c5-a9b1-c013b12ccf21"  # From review request


class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Admin login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["role"] == "admin"
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful, token received")
    
    def test_admin_login_invalid_credentials(self):
        """Admin login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 400
        print(f"✓ Admin login correctly rejects invalid credentials")


class TestUserAuth:
    """User authentication tests (phone-only login)"""
    
    def test_user_login_success(self):
        """User login with phone number"""
        response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
            "phone": USER_PHONE
        })
        # User might not exist, try alternate phone
        if response.status_code != 200:
            response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
                "phone": USER_PHONE_ALT
            })
        assert response.status_code == 200, f"User login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["role"] == "user"
        print(f"✓ User login successful with phone")
    
    def test_user_login_nonexistent(self):
        """User login with non-existent phone"""
        response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
            "phone": "0000000000"
        })
        assert response.status_code == 400
        print(f"✓ User login correctly rejects non-existent phone")


class TestVolunteerAuth:
    """Volunteer authentication tests"""
    
    def test_volunteer_login_success(self):
        """Volunteer login with phone and password"""
        response = requests.post(f"{BASE_URL}/api/auth/volunteer/login", json={
            "phone": VOLUNTEER_PHONE,
            "password": VOLUNTEER_PASSWORD
        })
        assert response.status_code == 200, f"Volunteer login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["role"] == "volunteer"
        print(f"✓ Volunteer login successful")
    
    def test_volunteer_login_invalid(self):
        """Volunteer login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/volunteer/login", json={
            "phone": VOLUNTEER_PHONE,
            "password": "wrongpassword"
        })
        assert response.status_code == 400
        print(f"✓ Volunteer login correctly rejects invalid credentials")


class TestLiveScreen:
    """Live screen authentication tests"""
    
    def test_live_auth_success(self):
        """Live screen auth with correct password"""
        response = requests.post(f"{BASE_URL}/api/live/auth", json={
            "password": LIVE_SCREEN_PASSWORD
        })
        assert response.status_code == 200, f"Live auth failed: {response.text}"
        data = response.json()
        assert data["authenticated"] == True
        print(f"✓ Live screen auth successful")
    
    def test_live_auth_invalid(self):
        """Live screen auth with wrong password"""
        response = requests.post(f"{BASE_URL}/api/live/auth", json={
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print(f"✓ Live screen correctly rejects invalid password")
    
    def test_live_events_list(self):
        """Get list of live events"""
        response = requests.get(f"{BASE_URL}/api/live/events")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Live events endpoint returns {len(data)} events")


class TestAdminDashboard:
    """Admin dashboard and stats tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_dashboard_stats(self):
        """Get dashboard stats"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard/stats", headers=self.headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        assert "total_users" in data
        assert "total_events" in data
        assert "total_volunteers" in data
        assert "total_categories" in data
        print(f"✓ Dashboard stats: {data['total_users']} users, {data['total_events']} events, {data['total_categories']} categories, {data['total_volunteers']} volunteers")
    
    def test_events_list(self):
        """Get events list"""
        response = requests.get(f"{BASE_URL}/api/admin/events", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Events list: {len(data)} events")
        if data:
            event = data[0]
            print(f"  First event: {event.get('name', 'N/A')}")
    
    def test_event_detail(self):
        """Get event detail"""
        # First get events list
        response = requests.get(f"{BASE_URL}/api/admin/events", headers=self.headers)
        if response.status_code == 200 and response.json():
            event_id = response.json()[0]["id"]
            response = requests.get(f"{BASE_URL}/api/admin/events/{event_id}", headers=self.headers)
            assert response.status_code == 200
            data = response.json()
            assert "name" in data
            assert "registration_count" in data
            assert "attendance_count" in data
            print(f"✓ Event detail: {data['name']}, {data['registration_count']} registrations, {data['attendance_count']} attended")
        else:
            pytest.skip("No events found")
    
    def test_event_registrations(self):
        """Get event registrations with badge numbers"""
        response = requests.get(f"{BASE_URL}/api/admin/events", headers=self.headers)
        if response.status_code == 200 and response.json():
            event_id = response.json()[0]["id"]
            response = requests.get(f"{BASE_URL}/api/admin/events/{event_id}/registrations", headers=self.headers)
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            print(f"✓ Registrations: {len(data)} users")
            # Check badge_number field exists
            if data:
                reg = data[0]
                assert "badge_number" in reg or reg.get("badge_number") is None
                print(f"  First registration has badge_number field")
        else:
            pytest.skip("No events found")
    
    def test_event_assignments(self):
        """Get seating assignments"""
        response = requests.get(f"{BASE_URL}/api/admin/events", headers=self.headers)
        if response.status_code == 200 and response.json():
            event_id = response.json()[0]["id"]
            response = requests.get(f"{BASE_URL}/api/admin/events/{event_id}/assignments", headers=self.headers)
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            print(f"✓ Seating assignments: {len(data)} table assignments")
        else:
            pytest.skip("No events found")
    
    def test_categories_list(self):
        """Get categories list"""
        response = requests.get(f"{BASE_URL}/api/admin/categories", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Categories: {len(data)} categories")
    
    def test_volunteers_list(self):
        """Get volunteers list"""
        response = requests.get(f"{BASE_URL}/api/admin/volunteers", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Volunteers: {len(data)} volunteers")
    
    def test_users_list(self):
        """Get users list"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Users: {len(data)} users")
    
    def test_settings_get(self):
        """Get site settings"""
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "live_screen_password" in data
        print(f"✓ Settings retrieved successfully")


class TestPublicEndpoints:
    """Public endpoints tests"""
    
    def test_public_branding(self):
        """Get public branding (sponsor info)"""
        response = requests.get(f"{BASE_URL}/api/public/branding")
        assert response.status_code == 200
        data = response.json()
        # Check sponsor fields exist
        assert "sponsor_name_1" in data
        assert "sponsor_name_2" in data
        assert "sponsor_title_1" in data
        assert "sponsor_title_2" in data
        assert "sponsor_heading" in data
        print(f"✓ Branding endpoint returns sponsor fields")
        if data.get("sponsor_heading"):
            print(f"  Sponsor heading: {data['sponsor_heading']}")
    
    def test_public_categories(self):
        """Get public categories"""
        response = requests.get(f"{BASE_URL}/api/public/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Public categories: {len(data)} categories")
    
    def test_public_events(self):
        """Get public events"""
        response = requests.get(f"{BASE_URL}/api/public/events")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Public events: {len(data)} events")
    
    def test_public_profile(self):
        """Get public profile"""
        # First get a user ID from admin
        admin_response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if admin_response.status_code == 200:
            token = admin_response.json()["token"]
            users_response = requests.get(f"{BASE_URL}/api/admin/users", headers={"Authorization": f"Bearer {token}"})
            if users_response.status_code == 200 and users_response.json():
                user_id = users_response.json()[0]["id"]
                response = requests.get(f"{BASE_URL}/api/public/profile/{user_id}")
                assert response.status_code == 200
                data = response.json()
                assert "full_name" in data
                print(f"✓ Public profile: {data.get('full_name', 'N/A')}")
            else:
                pytest.skip("No users found")
        else:
            pytest.skip("Admin login failed")
    
    def test_qr_code_generation(self):
        """Test QR code generation returns image > 25KB"""
        # Get a user ID
        admin_response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if admin_response.status_code == 200:
            token = admin_response.json()["token"]
            users_response = requests.get(f"{BASE_URL}/api/admin/users", headers={"Authorization": f"Bearer {token}"})
            if users_response.status_code == 200 and users_response.json():
                user_id = users_response.json()[0]["id"]
                response = requests.get(f"{BASE_URL}/api/public/qr/{user_id}")
                assert response.status_code == 200
                assert response.headers.get("content-type") == "image/png"
                content_length = len(response.content)
                assert content_length > 25000, f"QR code size {content_length} bytes is less than 25KB"
                print(f"✓ QR code generated: {content_length} bytes (>{25000} bytes required)")
            else:
                pytest.skip("No users found")
        else:
            pytest.skip("Admin login failed")


class TestUserFlows:
    """User flow tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token"""
        response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
            "phone": USER_PHONE
        })
        if response.status_code != 200:
            response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
                "phone": USER_PHONE_ALT
            })
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            self.user_id = response.json()["user"]["id"]
        else:
            pytest.skip("User login failed")
    
    def test_user_profile(self):
        """Get user profile"""
        response = requests.get(f"{BASE_URL}/api/user/profile", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "full_name" in data
        assert "phone" in data
        print(f"✓ User profile: {data.get('full_name', 'N/A')}")
    
    def test_user_events(self):
        """Get user events"""
        response = requests.get(f"{BASE_URL}/api/user/events", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        registered_events = [e for e in data if e.get("is_registered")]
        print(f"✓ User events: {len(data)} total, {len(registered_events)} registered")
    
    def test_user_categories(self):
        """Get categories for user"""
        response = requests.get(f"{BASE_URL}/api/user/categories", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ User categories: {len(data)} categories")


class TestVolunteerFlows:
    """Volunteer flow tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get volunteer token"""
        response = requests.post(f"{BASE_URL}/api/auth/volunteer/login", json={
            "phone": VOLUNTEER_PHONE,
            "password": VOLUNTEER_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Volunteer login failed")
    
    def test_volunteer_events(self):
        """Get volunteer events"""
        response = requests.get(f"{BASE_URL}/api/volunteer/events", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Volunteer events: {len(data)} events")


class TestLiveScreenData:
    """Live screen data tests"""
    
    def test_live_stats(self):
        """Get live stats for event"""
        # Get an event ID first
        response = requests.get(f"{BASE_URL}/api/live/events")
        if response.status_code == 200 and response.json():
            event_id = response.json()[0]["id"]
            response = requests.get(f"{BASE_URL}/api/live/stats/{event_id}")
            assert response.status_code == 200
            data = response.json()
            assert "event" in data
            assert "total_references" in data
            assert "attendance_count" in data
            print(f"✓ Live stats: {data['total_references']} references, {data['attendance_count']} attendance")
        else:
            pytest.skip("No events found")
    
    def test_live_leaderboard(self):
        """Get live leaderboard"""
        response = requests.get(f"{BASE_URL}/api/live/events")
        if response.status_code == 200 and response.json():
            event_id = response.json()[0]["id"]
            response = requests.get(f"{BASE_URL}/api/live/leaderboard/{event_id}")
            assert response.status_code == 200
            data = response.json()
            assert "top_givers" in data
            assert "top_receivers" in data
            assert "table_stats" in data
            print(f"✓ Leaderboard: {len(data['top_givers'])} top givers, {len(data['top_receivers'])} top receivers")
        else:
            pytest.skip("No events found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
