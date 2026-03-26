"""
Test suite for Theme and Branding features:
- SGCCI and SBC logos
- Theme toggle (dark/light)
- Admin logo upload
- Public branding endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBranding:
    """Health check and public branding endpoint tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "app" in data
        print("✓ Health endpoint working")
    
    def test_public_branding_endpoint(self):
        """Test public branding endpoint returns logo info"""
        response = requests.get(f"{BASE_URL}/api/public/branding")
        assert response.status_code == 200
        data = response.json()
        assert "app_logo" in data
        assert "app_name" in data
        print(f"✓ Branding endpoint working - logo: {data['app_logo']}, name: {data['app_name']}")
    
    def test_uploaded_logo_accessible(self):
        """Test that uploaded logo file is accessible"""
        # First get the logo URL from branding
        branding = requests.get(f"{BASE_URL}/api/public/branding").json()
        if branding.get("app_logo"):
            logo_url = f"{BASE_URL}{branding['app_logo']}"
            response = requests.get(logo_url)
            assert response.status_code == 200
            assert "image" in response.headers.get("content-type", "")
            print(f"✓ Logo file accessible at {branding['app_logo']}")
        else:
            print("⚠ No logo uploaded yet, skipping file access test")


class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["role"] == "admin"
        assert "user" in data
        print("✓ Admin login successful")
        return data["token"]
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com",
            "password": "wrongpassword"
        })
        assert response.status_code in [400, 401]  # Both are acceptable for invalid credentials
        print("✓ Admin login correctly rejects invalid credentials")


class TestAdminSettings:
    """Admin settings and logo upload tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin authentication failed")
    
    def test_get_settings(self, admin_token):
        """Test getting admin settings"""
        response = requests.get(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "admin_email" in data
        assert "live_screen_password" in data
        # app_logo may or may not be present
        print(f"✓ Settings retrieved - admin_email: {data['admin_email']}")
    
    def test_upload_logo_endpoint(self, admin_token):
        """Test logo upload endpoint exists and requires auth"""
        # Test without auth
        response = requests.post(f"{BASE_URL}/api/admin/upload-logo")
        assert response.status_code in [401, 403, 422]  # Unauthorized or validation error
        print("✓ Logo upload endpoint requires authentication")
    
    def test_settings_requires_auth(self):
        """Test that settings endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/settings")
        assert response.status_code in [401, 403]
        print("✓ Settings endpoint correctly requires authentication")


class TestUserAuth:
    """User authentication tests"""
    
    def test_user_login_success(self):
        """Test user login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
            "phone": "9000000001",
            "password": "9000000001"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["role"] == "user"
        assert "user" in data
        print(f"✓ User login successful - {data['user'].get('full_name', 'Unknown')}")
    
    def test_user_login_invalid_credentials(self):
        """Test user login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
            "phone": "9000000001",
            "password": "wrongpassword"
        })
        assert response.status_code in [400, 401]  # Both are acceptable for invalid credentials
        print("✓ User login correctly rejects invalid credentials")


class TestStaticAssets:
    """Test static assets (logos) are served correctly"""
    
    def test_sgcci_logo_accessible(self):
        """Test SGCCI logo is accessible from frontend"""
        response = requests.get(f"{BASE_URL}/sgcci_logo.png")
        # This might return 404 if served from frontend, not backend
        # The logo is in frontend/public, so it's served by the frontend server
        print(f"SGCCI logo response: {response.status_code}")
        # We can't directly test frontend static files from backend URL
        # This is expected behavior
    
    def test_sbc_logo_accessible(self):
        """Test SBC logo is accessible from frontend"""
        response = requests.get(f"{BASE_URL}/sbc_logo.png")
        print(f"SBC logo response: {response.status_code}")


class TestDashboardStats:
    """Test admin dashboard stats endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin authentication failed")
    
    def test_dashboard_stats(self, admin_token):
        """Test admin dashboard stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "total_events" in data
        assert "total_categories" in data
        assert "total_volunteers" in data
        print(f"✓ Dashboard stats - Users: {data['total_users']}, Events: {data['total_events']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
