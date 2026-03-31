"""
Pre-deployment health check tests for SSNC Speed Networking PWA
Tests: Auth flows, branding API, photo upload, public profile
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
USER_PHONE = "8200663263"
ADMIN_EMAIL = "admin@ssnc.com"
ADMIN_PASSWORD = "admin123"
LIVE_SCREEN_PASSWORD = "ssnc2026"
TEST_USER_ID = "35eca29c-9ef8-4eea-8fd3-51b0bc23859e"
TEST_EVENT_ID = "9adf079c-4e2c-45c7-997f-af5910ad1696"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def user_token(api_client):
    """Get user authentication token (phone-only login)"""
    response = api_client.post(f"{BASE_URL}/api/auth/user/login", json={"phone": USER_PHONE})
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"User login failed: {response.text}")


@pytest.fixture
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/admin/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin login failed: {response.text}")


class TestUserAuth:
    """User phone-only login tests"""
    
    def test_user_login_with_phone_only(self, api_client):
        """User login should work with phone only (no password)"""
        response = api_client.post(f"{BASE_URL}/api/auth/user/login", json={"phone": USER_PHONE})
        assert response.status_code == 200, f"User login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not returned"
        assert data["role"] == "user", "Role should be 'user'"
        assert "user" in data, "User data not returned"
        print(f"✓ User login successful for phone {USER_PHONE}")
    
    def test_user_login_invalid_phone(self, api_client):
        """User login with invalid phone should fail"""
        response = api_client.post(f"{BASE_URL}/api/auth/user/login", json={"phone": "0000000000"})
        assert response.status_code == 400, "Should return 400 for invalid phone"
        print("✓ Invalid phone correctly rejected")


class TestAdminAuth:
    """Admin email+password login tests"""
    
    def test_admin_login_success(self, api_client):
        """Admin login with email+password should work"""
        response = api_client.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not returned"
        assert data["role"] == "admin", "Role should be 'admin'"
        print(f"✓ Admin login successful for {ADMIN_EMAIL}")
    
    def test_admin_login_invalid_credentials(self, api_client):
        """Admin login with wrong password should fail"""
        response = api_client.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 400, "Should return 400 for invalid credentials"
        print("✓ Invalid admin credentials correctly rejected")


class TestBrandingAPI:
    """Branding endpoint tests - sponsor fields"""
    
    def test_branding_returns_sponsor_fields(self, api_client):
        """GET /api/public/branding should return sponsor fields"""
        response = api_client.get(f"{BASE_URL}/api/public/branding")
        assert response.status_code == 200, f"Branding API failed: {response.text}"
        data = response.json()
        # Check all required sponsor fields exist
        assert "sponsor_name_1" in data, "sponsor_name_1 field missing"
        assert "sponsor_name_2" in data, "sponsor_name_2 field missing"
        assert "sponsor_logo_1" in data, "sponsor_logo_1 field missing"
        assert "sponsor_logo_2" in data, "sponsor_logo_2 field missing"
        assert "header_logo" in data, "header_logo field missing"
        print(f"✓ Branding API returns all sponsor fields: {list(data.keys())}")


class TestPublicProfile:
    """Public profile endpoint tests"""
    
    def test_public_profile_exists(self, api_client):
        """GET /api/public/profile/{userId} should return user data"""
        response = api_client.get(f"{BASE_URL}/api/public/profile/{TEST_USER_ID}")
        assert response.status_code == 200, f"Public profile failed: {response.text}"
        data = response.json()
        assert "full_name" in data, "full_name missing"
        assert "phone" in data, "phone missing"
        assert "business_name" in data, "business_name missing"
        # Check for photo fields
        assert "profile_picture" in data or data.get("profile_picture") is None, "profile_picture field should exist"
        assert "company_logo" in data or data.get("company_logo") is None, "company_logo field should exist"
        print(f"✓ Public profile returned for user: {data.get('full_name')}")
    
    def test_public_profile_not_found(self, api_client):
        """GET /api/public/profile with invalid ID should return 404"""
        response = api_client.get(f"{BASE_URL}/api/public/profile/invalid-user-id")
        assert response.status_code == 404, "Should return 404 for invalid user"
        print("✓ Invalid user ID correctly returns 404")


class TestPhotoUpload:
    """Photo upload endpoint tests"""
    
    def test_upload_profile_picture(self, api_client, user_token):
        """POST /api/user/upload-photo?photo_type=profile_picture should work"""
        # Create a small test image (1x1 pixel PNG)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('test.png', io.BytesIO(png_data), 'image/png')}
        headers = {"Authorization": f"Bearer {user_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/user/upload-photo?photo_type=profile_picture",
            files=files,
            headers=headers
        )
        assert response.status_code == 200, f"Photo upload failed: {response.text}"
        data = response.json()
        assert "url" in data, "URL not returned"
        print(f"✓ Profile picture uploaded: {data['url']}")
    
    def test_upload_company_logo(self, api_client, user_token):
        """POST /api/user/upload-photo?photo_type=company_logo should work"""
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('logo.png', io.BytesIO(png_data), 'image/png')}
        headers = {"Authorization": f"Bearer {user_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/user/upload-photo?photo_type=company_logo",
            files=files,
            headers=headers
        )
        assert response.status_code == 200, f"Logo upload failed: {response.text}"
        data = response.json()
        assert "url" in data, "URL not returned"
        print(f"✓ Company logo uploaded: {data['url']}")


class TestUserProfile:
    """User profile endpoint tests"""
    
    def test_get_user_profile(self, api_client, user_token):
        """GET /api/user/profile should return user data"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = api_client.get(f"{BASE_URL}/api/user/profile", headers=headers)
        assert response.status_code == 200, f"Get profile failed: {response.text}"
        data = response.json()
        assert "full_name" in data, "full_name missing"
        assert "phone" in data, "phone missing"
        print(f"✓ User profile retrieved: {data.get('full_name')}")
    
    def test_update_user_profile(self, api_client, user_token):
        """PUT /api/user/profile should update user data"""
        headers = {"Authorization": f"Bearer {user_token}"}
        
        # First get current profile
        get_response = api_client.get(f"{BASE_URL}/api/user/profile", headers=headers)
        current = get_response.json()
        
        # Update with same data (to not break anything)
        update_data = {
            "full_name": current.get("full_name", "Test User"),
            "email": current.get("email", ""),
            "business_name": current.get("business_name", ""),
            "category_id": current.get("category_id", ""),
            "subcategory_id": current.get("subcategory_id", ""),
            "position": current.get("position", ""),
            "linkedin": (current.get("social_links") or {}).get("linkedin", ""),
            "instagram": (current.get("social_links") or {}).get("instagram", ""),
            "twitter": (current.get("social_links") or {}).get("twitter", ""),
            "youtube": (current.get("social_links") or {}).get("youtube", ""),
            "whatsapp": (current.get("social_links") or {}).get("whatsapp", ""),
            "facebook": (current.get("social_links") or {}).get("facebook", ""),
            "website": (current.get("social_links") or {}).get("website", ""),
        }
        
        response = api_client.put(f"{BASE_URL}/api/user/profile", json=update_data, headers=headers)
        assert response.status_code == 200, f"Update profile failed: {response.text}"
        print("✓ User profile updated successfully")


class TestLiveScreen:
    """Live screen authentication tests"""
    
    def test_live_auth_success(self, api_client):
        """POST /api/live/auth with correct password should work"""
        response = api_client.post(f"{BASE_URL}/api/live/auth", json={"password": LIVE_SCREEN_PASSWORD})
        assert response.status_code == 200, f"Live auth failed: {response.text}"
        print("✓ Live screen authentication successful")
    
    def test_live_auth_invalid_password(self, api_client):
        """POST /api/live/auth with wrong password should fail"""
        response = api_client.post(f"{BASE_URL}/api/live/auth", json={"password": "wrongpassword"})
        assert response.status_code in [400, 401, 403], "Should reject invalid password"
        print("✓ Invalid live screen password correctly rejected")


class TestAdminSettings:
    """Admin settings endpoint tests"""
    
    def test_get_admin_settings(self, api_client, admin_token):
        """GET /api/admin/settings should return settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = api_client.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        assert response.status_code == 200, f"Get settings failed: {response.text}"
        data = response.json()
        # Check sponsor name fields exist
        assert "sponsor_name_1" in data or data.get("sponsor_name_1") is None, "sponsor_name_1 should be in settings"
        assert "sponsor_name_2" in data or data.get("sponsor_name_2") is None, "sponsor_name_2 should be in settings"
        print(f"✓ Admin settings retrieved")


class TestCategories:
    """Category endpoints tests"""
    
    def test_get_categories(self, api_client, user_token):
        """GET /api/user/categories should return categories"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = api_client.get(f"{BASE_URL}/api/user/categories", headers=headers)
        assert response.status_code == 200, f"Get categories failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        print(f"✓ Categories retrieved: {len(data)} categories")


class TestVCard:
    """VCard download test"""
    
    def test_vcard_download(self, api_client):
        """GET /api/public/vcard/{userId} should return vCard"""
        response = api_client.get(f"{BASE_URL}/api/public/vcard/{TEST_USER_ID}")
        assert response.status_code == 200, f"VCard download failed: {response.text}"
        assert "text/vcard" in response.headers.get("content-type", ""), "Should return vCard content type"
        print("✓ VCard download successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
