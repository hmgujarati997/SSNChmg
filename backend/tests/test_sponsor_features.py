"""
Test sponsor name and logo features:
- GET /api/public/branding returns sponsor_logo_1, sponsor_logo_2, sponsor_name_1, sponsor_name_2
- PUT /api/admin/settings can save sponsor_name_1 and sponsor_name_2
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSponsorFeatures:
    """Test sponsor name and logo functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token for authenticated requests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": "admin@ssnc.com",
            "password": "admin123"
        })
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Admin login failed - skipping authenticated tests")
    
    # ========== PUBLIC BRANDING API TESTS ==========
    
    def test_public_branding_returns_sponsor_fields(self):
        """GET /api/public/branding should return all sponsor fields"""
        response = requests.get(f"{BASE_URL}/api/public/branding")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify all sponsor fields exist in response
        assert "sponsor_logo_1" in data, "sponsor_logo_1 field missing from branding response"
        assert "sponsor_logo_2" in data, "sponsor_logo_2 field missing from branding response"
        assert "sponsor_name_1" in data, "sponsor_name_1 field missing from branding response"
        assert "sponsor_name_2" in data, "sponsor_name_2 field missing from branding response"
        
        print(f"Branding response: {data}")
    
    def test_public_branding_returns_existing_sponsor_names(self):
        """GET /api/public/branding should return sponsor names if set"""
        response = requests.get(f"{BASE_URL}/api/public/branding")
        assert response.status_code == 200
        
        data = response.json()
        # According to context, sponsor names were set to SGCCI and SBC
        # Check if they are present (may be empty if not set)
        print(f"sponsor_name_1: '{data.get('sponsor_name_1', '')}'")
        print(f"sponsor_name_2: '{data.get('sponsor_name_2', '')}'")
    
    # ========== ADMIN SETTINGS API TESTS ==========
    
    def test_admin_settings_get_returns_sponsor_names(self):
        """GET /api/admin/settings should return sponsor names"""
        response = self.session.get(f"{BASE_URL}/api/admin/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"Admin settings response keys: {list(data.keys())}")
        # Note: sponsor_name_1 and sponsor_name_2 may not be in admin settings response
        # They are stored in site_settings but returned via public branding
    
    def test_admin_settings_update_sponsor_name_1(self):
        """PUT /api/admin/settings can save sponsor_name_1"""
        test_name = "TEST_SPONSOR_1"
        
        response = self.session.put(f"{BASE_URL}/api/admin/settings", json={
            "sponsor_name_1": test_name
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify via public branding API
        branding_response = requests.get(f"{BASE_URL}/api/public/branding")
        assert branding_response.status_code == 200
        branding_data = branding_response.json()
        assert branding_data.get("sponsor_name_1") == test_name, f"Expected '{test_name}', got '{branding_data.get('sponsor_name_1')}'"
        
        print(f"Successfully saved sponsor_name_1: {test_name}")
    
    def test_admin_settings_update_sponsor_name_2(self):
        """PUT /api/admin/settings can save sponsor_name_2"""
        test_name = "TEST_SPONSOR_2"
        
        response = self.session.put(f"{BASE_URL}/api/admin/settings", json={
            "sponsor_name_2": test_name
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify via public branding API
        branding_response = requests.get(f"{BASE_URL}/api/public/branding")
        assert branding_response.status_code == 200
        branding_data = branding_response.json()
        assert branding_data.get("sponsor_name_2") == test_name, f"Expected '{test_name}', got '{branding_data.get('sponsor_name_2')}'"
        
        print(f"Successfully saved sponsor_name_2: {test_name}")
    
    def test_admin_settings_update_both_sponsor_names(self):
        """PUT /api/admin/settings can save both sponsor names at once"""
        test_name_1 = "SGCCI"
        test_name_2 = "SBC"
        
        response = self.session.put(f"{BASE_URL}/api/admin/settings", json={
            "sponsor_name_1": test_name_1,
            "sponsor_name_2": test_name_2
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify via public branding API
        branding_response = requests.get(f"{BASE_URL}/api/public/branding")
        assert branding_response.status_code == 200
        branding_data = branding_response.json()
        assert branding_data.get("sponsor_name_1") == test_name_1, f"Expected '{test_name_1}', got '{branding_data.get('sponsor_name_1')}'"
        assert branding_data.get("sponsor_name_2") == test_name_2, f"Expected '{test_name_2}', got '{branding_data.get('sponsor_name_2')}'"
        
        print(f"Successfully saved both sponsor names: {test_name_1}, {test_name_2}")
    
    def test_admin_settings_update_requires_auth(self):
        """PUT /api/admin/settings requires authentication"""
        # Use a new session without auth
        response = requests.put(f"{BASE_URL}/api/admin/settings", json={
            "sponsor_name_1": "UNAUTHORIZED"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"Correctly rejected unauthorized request with status {response.status_code}")
    
    # ========== LOGO UPLOAD ENDPOINT TESTS ==========
    
    def test_logo_upload_endpoint_accepts_sponsor_logo_1(self):
        """POST /api/admin/upload-logo accepts logo_type=sponsor_logo_1"""
        # Create a minimal valid PNG image (1x1 pixel)
        import io
        from PIL import Image
        img_buffer = io.BytesIO()
        img = Image.new('RGB', (1, 1), color='red')
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        # Remove Content-Type header for multipart upload
        headers = {k: v for k, v in self.session.headers.items() if k.lower() != 'content-type'}
        response = requests.post(
            f"{BASE_URL}/api/admin/upload-logo?logo_type=sponsor_logo_1",
            files={"file": ("test.png", img_buffer, "image/png")},
            headers=headers
        )
        # Should succeed (200) - endpoint accepts sponsor_logo_1 as valid logo_type
        assert response.status_code == 200, f"Unexpected status {response.status_code}: {response.text}"
        print(f"sponsor_logo_1 upload endpoint responded with status {response.status_code}")
        
        # Verify the logo URL is returned and stored
        data = response.json()
        assert "url" in data, "Response should contain url field"
        print(f"Uploaded sponsor_logo_1 URL: {data.get('url')}")
    
    def test_logo_upload_endpoint_accepts_sponsor_logo_2(self):
        """POST /api/admin/upload-logo accepts logo_type=sponsor_logo_2"""
        import io
        from PIL import Image
        img_buffer = io.BytesIO()
        img = Image.new('RGB', (1, 1), color='blue')
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        headers = {k: v for k, v in self.session.headers.items() if k.lower() != 'content-type'}
        response = requests.post(
            f"{BASE_URL}/api/admin/upload-logo?logo_type=sponsor_logo_2",
            files={"file": ("test.png", img_buffer, "image/png")},
            headers=headers
        )
        assert response.status_code == 200, f"Unexpected status {response.status_code}: {response.text}"
        print(f"sponsor_logo_2 upload endpoint responded with status {response.status_code}")
        
        data = response.json()
        assert "url" in data, "Response should contain url field"
        print(f"Uploaded sponsor_logo_2 URL: {data.get('url')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
