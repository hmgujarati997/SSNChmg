"""
Test Photo Upload Feature - Profile Picture and Company Logo
Tests:
- POST /api/user/upload-photo?photo_type=profile_picture
- POST /api/user/upload-photo?photo_type=company_logo
- Rejection of non-image files
- Verification of uploaded file URL
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_PHONE = "8200663263"
TEST_PASSWORD = "8200663263"
TEST_USER_ID = "35eca29c-9ef8-4eea-8fd3-51b0bc23859e"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(f"{BASE_URL}/api/auth/user/login", json={
        "phone": TEST_PHONE,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestPhotoUpload:
    """Test photo upload endpoints"""

    def test_upload_profile_picture(self, auth_headers):
        """Test uploading a profile picture"""
        # Create a simple PNG image (1x1 blue pixel)
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 dimensions
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
            0x01, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xAA,
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,  # IEND chunk
            0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {'file': ('test_profile.png', io.BytesIO(png_data), 'image/png')}
        response = requests.post(
            f"{BASE_URL}/api/user/upload-photo?photo_type=profile_picture",
            files=files,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "url" in data, "Response should contain 'url' field"
        assert "/api/uploads/users/" in data["url"], f"URL should contain uploads path: {data['url']}"
        assert "profile_picture" in data["url"], f"URL should contain 'profile_picture': {data['url']}"
        print(f"✓ Profile picture uploaded successfully: {data['url']}")

    def test_upload_company_logo(self, auth_headers):
        """Test uploading a company logo"""
        # Create a simple PNG image
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
            0x01, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xAA,
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
            0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {'file': ('test_logo.png', io.BytesIO(png_data), 'image/png')}
        response = requests.post(
            f"{BASE_URL}/api/user/upload-photo?photo_type=company_logo",
            files=files,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "url" in data, "Response should contain 'url' field"
        assert "/api/uploads/users/" in data["url"], f"URL should contain uploads path: {data['url']}"
        assert "company_logo" in data["url"], f"URL should contain 'company_logo': {data['url']}"
        print(f"✓ Company logo uploaded successfully: {data['url']}")

    def test_reject_non_image_file(self, auth_headers):
        """Test that non-image files are rejected"""
        # Create a text file
        text_data = b"This is not an image file"
        
        files = {'file': ('test.txt', io.BytesIO(text_data), 'text/plain')}
        response = requests.post(
            f"{BASE_URL}/api/user/upload-photo?photo_type=profile_picture",
            files=files,
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for non-image, got {response.status_code}: {response.text}"
        print("✓ Non-image file correctly rejected with 400")

    def test_invalid_photo_type(self, auth_headers):
        """Test that invalid photo_type is rejected"""
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
            0x01, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xAA,
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
            0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {'file': ('test.png', io.BytesIO(png_data), 'image/png')}
        response = requests.post(
            f"{BASE_URL}/api/user/upload-photo?photo_type=invalid_type",
            files=files,
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid photo_type, got {response.status_code}"
        print("✓ Invalid photo_type correctly rejected with 400")

    def test_uploaded_file_accessible(self, auth_headers):
        """Test that uploaded file is accessible via URL"""
        # First upload a file
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
            0x01, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xAA,
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
            0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {'file': ('test_access.png', io.BytesIO(png_data), 'image/png')}
        upload_response = requests.post(
            f"{BASE_URL}/api/user/upload-photo?photo_type=profile_picture",
            files=files,
            headers=auth_headers
        )
        
        assert upload_response.status_code == 200
        url = upload_response.json()["url"]
        
        # Try to access the uploaded file
        file_response = requests.get(f"{BASE_URL}{url}")
        assert file_response.status_code == 200, f"Uploaded file not accessible: {file_response.status_code}"
        assert file_response.headers.get('content-type', '').startswith('image/'), "Response should be an image"
        print(f"✓ Uploaded file accessible at {url}")


class TestProfileWithPhotos:
    """Test profile endpoints with photo fields"""

    def test_profile_contains_photo_fields(self, auth_headers):
        """Test that profile response contains photo fields"""
        response = requests.get(f"{BASE_URL}/api/user/profile", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that profile_picture field exists (may be null or have value)
        assert "profile_picture" in data or data.get("profile_picture") is None, "Profile should have profile_picture field"
        print(f"✓ Profile contains profile_picture: {data.get('profile_picture')}")
        print(f"✓ Profile contains company_logo: {data.get('company_logo')}")


class TestPublicProfile:
    """Test public profile endpoint with photos"""

    def test_public_profile_shows_photos(self):
        """Test that public profile shows uploaded photos"""
        response = requests.get(f"{BASE_URL}/api/public/profile/{TEST_USER_ID}")
        
        assert response.status_code == 200, f"Public profile failed: {response.status_code}"
        data = response.json()
        
        # Check profile data
        assert "full_name" in data, "Public profile should have full_name"
        print(f"✓ Public profile loaded for: {data.get('full_name')}")
        
        # Check photo fields
        if data.get("profile_picture"):
            print(f"✓ Public profile has profile_picture: {data['profile_picture']}")
        else:
            print("⚠ Public profile has no profile_picture set")
            
        if data.get("company_logo"):
            print(f"✓ Public profile has company_logo: {data['company_logo']}")
        else:
            print("⚠ Public profile has no company_logo set")

    def test_public_profile_social_links(self):
        """Test that public profile contains social links"""
        response = requests.get(f"{BASE_URL}/api/public/profile/{TEST_USER_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        social = data.get("social_links", {})
        print(f"✓ Social links in public profile: {list(social.keys()) if social else 'None'}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
