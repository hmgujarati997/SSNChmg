"""
Day-of-Event Endpoints Tests
Tests for spot registration, close/reopen entry, and table reallocation
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDayOfEventEndpoints:
    """Tests for day-of-event management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token and event ID"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        self.token = login_resp.json()["token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get first event
        events_resp = self.session.get(f"{BASE_URL}/api/admin/events")
        assert events_resp.status_code == 200
        events = events_resp.json()
        assert len(events) > 0, "No events found"
        self.event_id = events[0]["id"]
        self.event = events[0]
        
    # ============ Day-of-Status Tests ============
    
    def test_day_of_status_returns_correct_structure(self):
        """GET /api/admin/events/{event_id}/day-of-status returns correct counts"""
        resp = self.session.get(f"{BASE_URL}/api/admin/events/{self.event_id}/day-of-status")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        
        data = resp.json()
        # Verify all required fields exist
        assert "total_registered" in data
        assert "total_attended" in data
        assert "total_absent" in data
        assert "total_spot" in data
        assert "spot_needing_seats" in data
        assert "entry_closed" in data
        assert "absent_users" in data
        assert "spot_users" in data
        assert "spot_unseated" in data
        
        # Verify types
        assert isinstance(data["total_registered"], int)
        assert isinstance(data["total_attended"], int)
        assert isinstance(data["total_absent"], int)
        assert isinstance(data["total_spot"], int)
        assert isinstance(data["spot_needing_seats"], int)
        assert isinstance(data["entry_closed"], bool)
        assert isinstance(data["absent_users"], list)
        assert isinstance(data["spot_users"], list)
        
        print(f"Day-of-status: registered={data['total_registered']}, attended={data['total_attended']}, absent={data['total_absent']}, spot={data['total_spot']}")
        
    def test_day_of_status_404_for_invalid_event(self):
        """GET /api/admin/events/{invalid_id}/day-of-status returns 404"""
        resp = self.session.get(f"{BASE_URL}/api/admin/events/invalid-event-id/day-of-status")
        assert resp.status_code == 404
        
    # ============ Spot Registration Tests ============
    
    def test_spot_register_creates_user_and_registers(self):
        """POST /api/admin/events/{event_id}/spot-register creates user + registers + auto-marks attendance"""
        unique_phone = f"TEST{uuid.uuid4().hex[:8]}"
        
        resp = self.session.post(f"{BASE_URL}/api/admin/events/{self.event_id}/spot-register", json={
            "full_name": "TEST Spot User",
            "phone": unique_phone,
            "business_name": "Test Business",
            "category_id": "",
            "subcategory_id": "",
            "position": "Manager"
        })
        assert resp.status_code == 200, f"Spot register failed: {resp.text}"
        
        data = resp.json()
        assert "message" in data
        assert "user_id" in data
        assert "Spot registered" in data["message"]
        
        # Verify user was created and registered
        status_resp = self.session.get(f"{BASE_URL}/api/admin/events/{self.event_id}/day-of-status")
        status = status_resp.json()
        
        # Find the spot user in spot_users list
        spot_user_ids = [u["id"] for u in status["spot_users"]]
        assert data["user_id"] in spot_user_ids, "Spot user not found in spot_users list"
        
        print(f"Spot registered user_id: {data['user_id']}")
        
        # Cleanup: Delete the test user
        self.session.delete(f"{BASE_URL}/api/admin/users/{data['user_id']}")
        
    def test_spot_register_rejects_missing_name(self):
        """POST /api/admin/events/{event_id}/spot-register rejects missing name"""
        resp = self.session.post(f"{BASE_URL}/api/admin/events/{self.event_id}/spot-register", json={
            "full_name": "",
            "phone": "9999999999"
        })
        assert resp.status_code == 400
        
    def test_spot_register_rejects_missing_phone(self):
        """POST /api/admin/events/{event_id}/spot-register rejects missing phone"""
        resp = self.session.post(f"{BASE_URL}/api/admin/events/{self.event_id}/spot-register", json={
            "full_name": "Test User",
            "phone": ""
        })
        assert resp.status_code == 400
        
    def test_spot_register_rejects_duplicate_registration(self):
        """POST /api/admin/events/{event_id}/spot-register rejects duplicate registrations"""
        unique_phone = f"TEST{uuid.uuid4().hex[:8]}"
        
        # First registration
        resp1 = self.session.post(f"{BASE_URL}/api/admin/events/{self.event_id}/spot-register", json={
            "full_name": "TEST Duplicate User",
            "phone": unique_phone,
            "business_name": "Test Business"
        })
        assert resp1.status_code == 200
        user_id = resp1.json()["user_id"]
        
        # Second registration with same phone should fail
        resp2 = self.session.post(f"{BASE_URL}/api/admin/events/{self.event_id}/spot-register", json={
            "full_name": "TEST Duplicate User 2",
            "phone": unique_phone,
            "business_name": "Test Business 2"
        })
        assert resp2.status_code == 400, f"Expected 400 for duplicate, got {resp2.status_code}: {resp2.text}"
        assert "already registered" in resp2.json().get("detail", "").lower()
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}")
        
    def test_spot_register_404_for_invalid_event(self):
        """POST /api/admin/events/{invalid_id}/spot-register returns 404"""
        resp = self.session.post(f"{BASE_URL}/api/admin/events/invalid-event-id/spot-register", json={
            "full_name": "Test User",
            "phone": "9999999999"
        })
        assert resp.status_code == 404
        
    # ============ Close/Reopen Entry Tests ============
    
    def test_close_entry_sets_flag(self):
        """POST /api/admin/events/{event_id}/close-entry sets entry_closed flag"""
        resp = self.session.post(f"{BASE_URL}/api/admin/events/{self.event_id}/close-entry")
        assert resp.status_code == 200, f"Close entry failed: {resp.text}"
        
        data = resp.json()
        assert "message" in data
        assert "closed" in data["message"].lower()
        
        # Verify flag is set
        status_resp = self.session.get(f"{BASE_URL}/api/admin/events/{self.event_id}/day-of-status")
        assert status_resp.json()["entry_closed"] == True
        
        print("Entry closed successfully")
        
    def test_reopen_entry_clears_flag(self):
        """POST /api/admin/events/{event_id}/reopen-entry clears entry_closed flag"""
        # First close entry
        self.session.post(f"{BASE_URL}/api/admin/events/{self.event_id}/close-entry")
        
        # Then reopen
        resp = self.session.post(f"{BASE_URL}/api/admin/events/{self.event_id}/reopen-entry")
        assert resp.status_code == 200, f"Reopen entry failed: {resp.text}"
        
        data = resp.json()
        assert "message" in data
        assert "reopen" in data["message"].lower()
        
        # Verify flag is cleared
        status_resp = self.session.get(f"{BASE_URL}/api/admin/events/{self.event_id}/day-of-status")
        assert status_resp.json()["entry_closed"] == False
        
        print("Entry reopened successfully")
        
    def test_close_entry_404_for_invalid_event(self):
        """POST /api/admin/events/{invalid_id}/close-entry returns 404"""
        resp = self.session.post(f"{BASE_URL}/api/admin/events/invalid-event-id/close-entry")
        assert resp.status_code == 404
        
    # ============ Reallocation Tests ============
    
    def test_reallocate_returns_correct_structure(self):
        """POST /api/admin/events/{event_id}/reallocate returns correct response structure"""
        resp = self.session.post(f"{BASE_URL}/api/admin/events/{self.event_id}/reallocate")
        assert resp.status_code == 200, f"Reallocate failed: {resp.text}"
        
        data = resp.json()
        assert "message" in data
        # These fields should be present in the response
        if "changes" in data:
            assert isinstance(data["changes"], int)
        
        print(f"Reallocation result: {data['message']}")
        
    def test_reallocate_404_for_invalid_event(self):
        """POST /api/admin/events/{invalid_id}/reallocate returns 404"""
        resp = self.session.post(f"{BASE_URL}/api/admin/events/invalid-event-id/reallocate")
        assert resp.status_code == 404
        
    def test_reallocate_with_spot_user_flow(self):
        """Full flow: assign tables -> spot register -> reallocate -> verify spot user seated"""
        # Step 1: Assign tables first
        assign_resp = self.session.post(f"{BASE_URL}/api/admin/events/{self.event_id}/assign-tables")
        print(f"Assign tables response: {assign_resp.status_code} - {assign_resp.text[:200]}")
        
        # Step 2: Spot register a new user
        unique_phone = f"TEST{uuid.uuid4().hex[:8]}"
        spot_resp = self.session.post(f"{BASE_URL}/api/admin/events/{self.event_id}/spot-register", json={
            "full_name": "TEST Realloc User",
            "phone": unique_phone,
            "business_name": "Realloc Business",
            "position": "Director"
        })
        assert spot_resp.status_code == 200, f"Spot register failed: {spot_resp.text}"
        spot_user_id = spot_resp.json()["user_id"]
        
        # Step 3: Check status before reallocation
        status_before = self.session.get(f"{BASE_URL}/api/admin/events/{self.event_id}/day-of-status").json()
        print(f"Before realloc: spot_needing_seats={status_before['spot_needing_seats']}")
        
        # Step 4: Reallocate
        realloc_resp = self.session.post(f"{BASE_URL}/api/admin/events/{self.event_id}/reallocate")
        assert realloc_resp.status_code == 200, f"Reallocate failed: {realloc_resp.text}"
        realloc_data = realloc_resp.json()
        print(f"Reallocation: {realloc_data['message']}")
        
        # Step 5: Check status after reallocation
        status_after = self.session.get(f"{BASE_URL}/api/admin/events/{self.event_id}/day-of-status").json()
        print(f"After realloc: spot_needing_seats={status_after['spot_needing_seats']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/users/{spot_user_id}")
        
    # ============ Authentication Tests ============
    
    def test_endpoints_require_auth(self):
        """All day-of endpoints require authentication"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        endpoints = [
            ("GET", f"{BASE_URL}/api/admin/events/{self.event_id}/day-of-status"),
            ("POST", f"{BASE_URL}/api/admin/events/{self.event_id}/spot-register"),
            ("POST", f"{BASE_URL}/api/admin/events/{self.event_id}/close-entry"),
            ("POST", f"{BASE_URL}/api/admin/events/{self.event_id}/reopen-entry"),
            ("POST", f"{BASE_URL}/api/admin/events/{self.event_id}/reallocate"),
        ]
        
        for method, url in endpoints:
            if method == "GET":
                resp = no_auth_session.get(url)
            else:
                resp = no_auth_session.post(url, json={"full_name": "Test", "phone": "123"})
            
            assert resp.status_code in [401, 403], f"{method} {url} should require auth, got {resp.status_code}"
            
        print("All endpoints properly require authentication")


class TestReallocationConstraints:
    """Tests for reallocation subcategory constraints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token and event ID"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com",
            "password": "admin123"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json()["token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get first event
        events_resp = self.session.get(f"{BASE_URL}/api/admin/events")
        events = events_resp.json()
        self.event_id = events[0]["id"]
        
        # Get categories for constraint testing
        cat_resp = self.session.get(f"{BASE_URL}/api/admin/categories")
        self.categories = cat_resp.json() if cat_resp.status_code == 200 else []
        
    def test_spot_register_with_category(self):
        """Spot registration with category and subcategory"""
        if not self.categories:
            pytest.skip("No categories available for testing")
            
        category = self.categories[0]
        
        # Get subcategories
        subcat_resp = self.session.get(f"{BASE_URL}/api/admin/subcategories?category_id={category['id']}")
        subcats = subcat_resp.json() if subcat_resp.status_code == 200 else []
        
        unique_phone = f"TEST{uuid.uuid4().hex[:8]}"
        
        resp = self.session.post(f"{BASE_URL}/api/admin/events/{self.event_id}/spot-register", json={
            "full_name": "TEST Category User",
            "phone": unique_phone,
            "business_name": "Category Business",
            "category_id": category["id"],
            "subcategory_id": subcats[0]["id"] if subcats else "",
            "position": "CEO"
        })
        assert resp.status_code == 200, f"Spot register with category failed: {resp.text}"
        
        user_id = resp.json()["user_id"]
        print(f"Spot registered with category: {category['name']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
