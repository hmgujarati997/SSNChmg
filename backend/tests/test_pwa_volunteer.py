"""
Test PWA and Volunteer features for SSNC Speed Networking app
- PWA manifest.json and sw.js endpoints
- Volunteer login and scan endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPWAEndpoints:
    """Test PWA static files are served correctly"""
    
    def test_manifest_json_served(self):
        """manifest.json should be served with correct content"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200, f"manifest.json returned {response.status_code}"
        
        data = response.json()
        assert data.get('name') == 'SSNC - Speed Networking Conclave', "manifest name incorrect"
        assert data.get('short_name') == 'SSNC', "manifest short_name incorrect"
        assert data.get('display') == 'standalone', "manifest display mode incorrect"
        assert 'icons' in data, "manifest missing icons"
        assert len(data['icons']) >= 2, "manifest should have at least 2 icons"
        print("✅ manifest.json served correctly with SSNC name and standalone display")
    
    def test_service_worker_served(self):
        """sw.js should be served"""
        response = requests.get(f"{BASE_URL}/sw.js")
        assert response.status_code == 200, f"sw.js returned {response.status_code}"
        assert 'CACHE_NAME' in response.text or 'ssnc-v1' in response.text, "sw.js missing cache config"
        print("✅ sw.js served correctly")
    
    def test_icon_192_served(self):
        """icon-192.png should be served"""
        response = requests.get(f"{BASE_URL}/icon-192.png")
        assert response.status_code == 200, f"icon-192.png returned {response.status_code}"
        print("✅ icon-192.png served correctly")
    
    def test_icon_512_served(self):
        """icon-512.png should be served"""
        response = requests.get(f"{BASE_URL}/icon-512.png")
        assert response.status_code == 200, f"icon-512.png returned {response.status_code}"
        print("✅ icon-512.png served correctly")


class TestHealthEndpoint:
    """Test API health endpoint"""
    
    def test_health_check(self):
        """Health endpoint should return ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'ok'
        print("✅ Health endpoint working")


class TestVolunteerAuth:
    """Test volunteer authentication"""
    
    def test_volunteer_login_success(self):
        """Volunteer should be able to login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/volunteer/login", json={
            "phone": "1111111111",
            "password": "vol123"
        })
        assert response.status_code == 200, f"Volunteer login failed: {response.text}"
        
        data = response.json()
        assert 'token' in data, "Response missing token"
        assert data.get('role') == 'volunteer', "Role should be volunteer"
        assert 'user' in data, "Response missing user data"
        print("✅ Volunteer login successful")
        return data['token']
    
    def test_volunteer_login_invalid_credentials(self):
        """Volunteer login should fail with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/volunteer/login", json={
            "phone": "9999999999",
            "password": "wrongpassword"
        })
        assert response.status_code == 400, "Should return 400 for invalid credentials"
        print("✅ Volunteer login correctly rejects invalid credentials")


class TestVolunteerEndpoints:
    """Test volunteer-specific endpoints"""
    
    @pytest.fixture
    def volunteer_token(self):
        """Get volunteer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/volunteer/login", json={
            "phone": "1111111111",
            "password": "vol123"
        })
        if response.status_code == 200:
            return response.json().get('token')
        pytest.skip("Volunteer login failed - skipping authenticated tests")
    
    def test_get_volunteer_events(self, volunteer_token):
        """Volunteer should be able to get events list"""
        headers = {"Authorization": f"Bearer {volunteer_token}"}
        response = requests.get(f"{BASE_URL}/api/volunteer/events", headers=headers)
        assert response.status_code == 200, f"Get events failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Events should be a list"
        print(f"✅ Volunteer events endpoint working - found {len(data)} events")
    
    def test_volunteer_events_requires_auth(self):
        """Volunteer events endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/volunteer/events")
        assert response.status_code in [401, 403], "Should require authentication"
        print("✅ Volunteer events endpoint correctly requires auth")


class TestAdminAuth:
    """Test admin authentication"""
    
    def test_admin_login_success(self):
        """Admin should be able to login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert 'token' in data, "Response missing token"
        assert data.get('role') == 'admin', "Role should be admin"
        print("✅ Admin login successful")
    
    def test_admin_login_invalid_credentials(self):
        """Admin login should fail with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "wrong@admin.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 400, "Should return 400 for invalid credentials"
        print("✅ Admin login correctly rejects invalid credentials")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
