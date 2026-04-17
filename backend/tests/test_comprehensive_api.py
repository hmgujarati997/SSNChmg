"""
Comprehensive Backend API Tests for SSNC Speed Networking PWA
Tests all major endpoints: Auth, Admin, User, Volunteer, Live, Public
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://clash-group.preview.emergentagent.com').rstrip('/')
EVENT_ID = '44f1f94d-0865-486a-b6e9-c0dcd0723a6a'


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert len(data["token"]) > 0
    
    def test_admin_login_invalid(self):
        """Admin login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "wrong@ssnc.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
    
    def test_user_login_phone_only(self):
        """User login with phone only (no password)"""
        response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
            "phone": "7874949091"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
    
    def test_volunteer_login_success(self):
        """Volunteer login with phone and password"""
        response = requests.post(f"{BASE_URL}/api/auth/volunteer/login", json={
            "phone": "9876543210",
            "password": "a@a.com"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data


class TestAdminEndpoints:
    """Admin API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com",
            "password": "admin123"
        })
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_get_events(self):
        """Get all events"""
        response = requests.get(f"{BASE_URL}/api/admin/events", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
    
    def test_get_event_detail(self):
        """Get single event details"""
        response = requests.get(f"{BASE_URL}/api/admin/events/{EVENT_ID}", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == EVENT_ID
        assert "name" in data
    
    def test_get_users(self):
        """Get all users"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
    
    def test_get_categories(self):
        """Get all categories"""
        response = requests.get(f"{BASE_URL}/api/admin/categories", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_registrations(self):
        """Get event registrations"""
        response = requests.get(f"{BASE_URL}/api/admin/events/{EVENT_ID}/registrations", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_settings(self):
        """Get site settings"""
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
    
    def test_round_control_toggle_references(self):
        """Test round control - toggle references"""
        # Get current state
        response = requests.get(f"{BASE_URL}/api/admin/events/{EVENT_ID}", headers=self.headers)
        current_state = response.json().get("references_enabled", False)
        
        # Toggle
        response = requests.post(
            f"{BASE_URL}/api/admin/events/{EVENT_ID}/round-control",
            headers=self.headers,
            json={"action": "toggle_references"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["references_enabled"] != current_state
        
        # Toggle back
        response = requests.post(
            f"{BASE_URL}/api/admin/events/{EVENT_ID}/round-control",
            headers=self.headers,
            json={"action": "toggle_references"}
        )
        assert response.status_code == 200
    
    def test_toggle_registration(self):
        """Test toggle registration endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/admin/events/{EVENT_ID}/toggle-registration",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "registration_open" in data
        
        # Toggle back
        requests.post(
            f"{BASE_URL}/api/admin/events/{EVENT_ID}/toggle-registration",
            headers=self.headers
        )


class TestUserEndpoints:
    """User API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
            "phone": "7874949091"
        })
        data = response.json()
        self.user_token = data["token"]
        self.user_id = data["user"]["id"]
        self.headers = {"Authorization": f"Bearer {self.user_token}"}
    
    def test_get_profile(self):
        """Get user profile"""
        response = requests.get(f"{BASE_URL}/api/user/profile", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "phone" in data
    
    def test_get_events(self):
        """Get available events for user"""
        response = requests.get(f"{BASE_URL}/api/user/events", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_my_tables(self):
        """Get user's table assignments"""
        response = requests.get(f"{BASE_URL}/api/user/events/{EVENT_ID}/my-tables", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_table_people(self):
        """Get people at user's table for round 1"""
        response = requests.get(f"{BASE_URL}/api/user/events/{EVENT_ID}/table-people/1", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "table_number" in data
        assert "people" in data
        # Verify profile_picture and social_links fields are present
        if data["people"]:
            person = data["people"][0]
            assert "profile_picture" in person
            assert "social_links" in person
    
    def test_lookup_badge(self):
        """Lookup user by badge number"""
        response = requests.get(f"{BASE_URL}/api/user/lookup-badge/{EVENT_ID}/5", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "full_name" in data
        assert "profile_picture" in data
        assert "social_links" in data
    
    def test_lookup_badge_self_error(self):
        """Lookup own badge should return error"""
        # First get user's badge number
        admin_resp = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com", "password": "admin123"
        })
        admin_token = admin_resp.json()["token"]
        regs = requests.get(
            f"{BASE_URL}/api/admin/events/{EVENT_ID}/registrations",
            headers={"Authorization": f"Bearer {admin_token}"}
        ).json()
        user_reg = next((r for r in regs if r.get("user", {}).get("id") == self.user_id), None)
        if user_reg and user_reg.get("badge_number"):
            response = requests.get(
                f"{BASE_URL}/api/user/lookup-badge/{EVENT_ID}/{user_reg['badge_number']}",
                headers=self.headers
            )
            assert response.status_code == 400
            assert "yourself" in response.json().get("detail", "").lower()
    
    def test_get_references(self):
        """Get user's references"""
        response = requests.get(f"{BASE_URL}/api/user/references/{EVENT_ID}", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "given" in data
        assert "received" in data


class TestReferencesToggle:
    """Test references enabled/disabled behavior"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin and user tokens"""
        admin_resp = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com", "password": "admin123"
        })
        self.admin_token = admin_resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        user_resp = requests.post(f"{BASE_URL}/api/auth/user/login", json={
            "phone": "7874949091"
        })
        self.user_token = user_resp.json()["token"]
        self.user_headers = {"Authorization": f"Bearer {self.user_token}"}
        
        # Get a target user
        users = requests.get(f"{BASE_URL}/api/admin/users", headers=self.admin_headers).json()
        self.target_user = next((u for u in users if u["id"] != user_resp.json()["user"]["id"]), None)
    
    def test_references_disabled_returns_403(self):
        """When references_enabled=false, POST /api/user/references returns 403"""
        # Ensure references are disabled
        event = requests.get(f"{BASE_URL}/api/admin/events/{EVENT_ID}", headers=self.admin_headers).json()
        if event.get("references_enabled", False):
            requests.post(
                f"{BASE_URL}/api/admin/events/{EVENT_ID}/round-control",
                headers=self.admin_headers,
                json={"action": "toggle_references"}
            )
        
        # Try to send reference
        response = requests.post(
            f"{BASE_URL}/api/user/references",
            headers=self.user_headers,
            json={
                "event_id": EVENT_ID,
                "to_user_id": self.target_user["id"],
                "round_number": 1,
                "table_number": 1,
                "notes": "Test",
                "contact_name": "Test Contact",
                "contact_phone": "9999999999"
            }
        )
        assert response.status_code == 403
        assert "not enabled" in response.json().get("detail", "").lower()
        
        # Re-enable references
        requests.post(
            f"{BASE_URL}/api/admin/events/{EVENT_ID}/round-control",
            headers=self.admin_headers,
            json={"action": "toggle_references"}
        )
    
    def test_references_enabled_succeeds(self):
        """When references_enabled=true, POST /api/user/references succeeds"""
        # Ensure references are enabled
        event = requests.get(f"{BASE_URL}/api/admin/events/{EVENT_ID}", headers=self.admin_headers).json()
        if not event.get("references_enabled", False):
            requests.post(
                f"{BASE_URL}/api/admin/events/{EVENT_ID}/round-control",
                headers=self.admin_headers,
                json={"action": "toggle_references"}
            )
        
        # Send reference
        response = requests.post(
            f"{BASE_URL}/api/user/references",
            headers=self.user_headers,
            json={
                "event_id": EVENT_ID,
                "to_user_id": self.target_user["id"],
                "round_number": 1,
                "table_number": 1,
                "notes": "Test ref enabled",
                "contact_name": "Test Contact",
                "contact_phone": "9999999999"
            }
        )
        assert response.status_code == 200
        assert "id" in response.json()


class TestVolunteerEndpoints:
    """Volunteer API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get volunteer token"""
        response = requests.post(f"{BASE_URL}/api/auth/volunteer/login", json={
            "phone": "9876543210",
            "password": "a@a.com"
        })
        self.volunteer_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.volunteer_token}"}
    
    def test_get_events(self):
        """Get events for volunteer"""
        response = requests.get(f"{BASE_URL}/api/volunteer/events", headers=self.headers)
        assert response.status_code == 200


class TestLiveEndpoints:
    """Live screen API endpoint tests"""
    
    def test_live_auth_success(self):
        """Live screen authentication with correct password"""
        response = requests.post(f"{BASE_URL}/api/live/auth", json={
            "password": "ssnc2026"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("authenticated") == True
    
    def test_live_auth_failure(self):
        """Live screen authentication with wrong password"""
        response = requests.post(f"{BASE_URL}/api/live/auth", json={
            "password": "wrongpassword"
        })
        assert response.status_code == 401
    
    def test_get_live_events(self):
        """Get live events"""
        response = requests.get(f"{BASE_URL}/api/live/events")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_live_stats(self):
        """Get live stats for event"""
        response = requests.get(f"{BASE_URL}/api/live/stats/{EVENT_ID}")
        assert response.status_code == 200
        data = response.json()
        assert "total_references" in data
        assert "attendance_count" in data
        assert "registration_count" in data
    
    def test_get_leaderboard(self):
        """Get leaderboard for event"""
        response = requests.get(f"{BASE_URL}/api/live/leaderboard/{EVENT_ID}")
        assert response.status_code == 200
        data = response.json()
        assert "top_givers" in data
        assert "top_receivers" in data


class TestPublicEndpoints:
    """Public API endpoint tests"""
    
    def test_get_branding(self):
        """Get public branding settings"""
        response = requests.get(f"{BASE_URL}/api/public/branding")
        assert response.status_code == 200
        data = response.json()
        assert "sponsor_logo_1" in data
        assert "tone_round_start" in data
    
    def test_get_public_categories(self):
        """Get public categories"""
        response = requests.get(f"{BASE_URL}/api/public/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_public_profile(self):
        """Get public user profile"""
        # First get a user ID
        admin_resp = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com", "password": "admin123"
        })
        admin_token = admin_resp.json()["token"]
        users = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        ).json()
        user_id = users[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/public/profile/{user_id}")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "full_name" in data
    
    def test_get_qr_code(self):
        """Get QR code for user"""
        admin_resp = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com", "password": "admin123"
        })
        admin_token = admin_resp.json()["token"]
        users = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        ).json()
        user_id = users[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/public/qr/{user_id}")
        assert response.status_code == 200
        assert response.headers.get("content-type") == "image/png"
        assert len(response.content) > 25000  # QR should be >25KB


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
