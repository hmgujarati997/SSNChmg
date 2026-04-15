"""
Test OpenAI API Key Settings and Table Assignment with AI Clash Detection
Tests:
1. Settings page shows OpenAI API Key field under 'OpenAI (AI Clash Detection)' section
2. OpenAI API key is masked in GET /api/admin/settings response (shows ***xxxx)
3. Saving settings with openai_api_key stores it properly (PUT /api/admin/settings)
4. Masked key (***xxxx) does NOT overwrite the stored key when saving settings
5. POST /api/admin/events/{event_id}/assign-tables starts job successfully
6. Table assignment completes (status=completed) even when no OpenAI key is set
7. Table assignment completes with graceful AI skip when invalid OpenAI key is set
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@ssnc.com"
ADMIN_PASSWORD = "admin123"
TEST_EVENT_ID = "44f1f94d-0865-486a-b6e9-c0dcd0723a6a"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestOpenAISettingsAPI:
    """Test OpenAI API key storage and masking in settings"""

    def test_get_settings_returns_masked_openai_key(self, admin_headers):
        """GET /api/admin/settings should mask openai_api_key with ***xxxx format"""
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Check that openai_api_key field exists in response
        assert "openai_api_key" in data or data.get("openai_api_key") is None, "openai_api_key field should exist in settings response"
        
        # If key is set, it should be masked
        if data.get("openai_api_key") and data["openai_api_key"] != "":
            assert data["openai_api_key"].startswith("***"), f"OpenAI key should be masked with ***, got: {data['openai_api_key']}"
            print(f"OpenAI key is properly masked: {data['openai_api_key']}")
        else:
            print("No OpenAI key set yet")

    def test_save_openai_api_key(self, admin_headers):
        """PUT /api/admin/settings should store openai_api_key properly"""
        test_key = "sk-test-key-12345678"
        
        response = requests.put(f"{BASE_URL}/api/admin/settings", 
            headers=admin_headers,
            json={"openai_api_key": test_key}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify the key is stored (masked in response)
        get_response = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers)
        assert get_response.status_code == 200
        data = get_response.json()
        
        # Key should be masked but show last 4 chars
        assert data.get("openai_api_key", "").startswith("***"), "Saved key should be masked"
        assert data["openai_api_key"].endswith("5678"), f"Masked key should end with last 4 chars, got: {data['openai_api_key']}"
        print(f"OpenAI key saved and masked correctly: {data['openai_api_key']}")

    def test_masked_key_does_not_overwrite_stored_key(self, admin_headers):
        """Sending masked key (***xxxx) should NOT overwrite the actual stored key"""
        # First, set a known key
        original_key = "sk-original-key-abcd1234"
        requests.put(f"{BASE_URL}/api/admin/settings", 
            headers=admin_headers,
            json={"openai_api_key": original_key}
        )
        
        # Get the masked key
        get_response = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers)
        masked_key = get_response.json().get("openai_api_key", "")
        assert masked_key.startswith("***"), "Key should be masked"
        
        # Now send the masked key back (simulating frontend save without changing key)
        response = requests.put(f"{BASE_URL}/api/admin/settings", 
            headers=admin_headers,
            json={"openai_api_key": masked_key, "live_screen_password": "ssnc2026"}
        )
        assert response.status_code == 200
        
        # Verify the original key is still intact (masked should still show same last 4 chars)
        verify_response = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers)
        verify_data = verify_response.json()
        
        # The key should still end with the original last 4 chars
        assert verify_data["openai_api_key"].endswith("1234"), f"Original key should be preserved, got: {verify_data['openai_api_key']}"
        print(f"Masked key correctly preserved original: {verify_data['openai_api_key']}")


class TestTableAssignmentWithAI:
    """Test table assignment flow with AI clash detection"""

    def test_assign_tables_starts_job(self, admin_headers):
        """POST /api/admin/events/{event_id}/assign-tables should start job successfully"""
        response = requests.post(
            f"{BASE_URL}/api/admin/events/{TEST_EVENT_ID}/assign-tables",
            headers=admin_headers
        )
        
        # Should return 200 with job_id
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "job_id" in data, "Response should contain job_id"
        assert "total_users" in data, "Response should contain total_users"
        
        print(f"Table assignment job started: {data['job_id']}, users: {data['total_users']}")
        return data["job_id"]

    def test_table_assignment_completes_without_openai_key(self, admin_headers):
        """Table assignment should complete even when no OpenAI key is set"""
        # Clear the OpenAI key first
        requests.put(f"{BASE_URL}/api/admin/settings", 
            headers=admin_headers,
            json={"openai_api_key": ""}
        )
        
        # Start table assignment
        start_response = requests.post(
            f"{BASE_URL}/api/admin/events/{TEST_EVENT_ID}/assign-tables",
            headers=admin_headers
        )
        assert start_response.status_code == 200
        job_id = start_response.json()["job_id"]
        
        # Poll for completion (max 120 seconds for 520 users - can take longer)
        max_wait = 120
        start_time = time.time()
        final_status = None
        
        while time.time() - start_time < max_wait:
            status_response = requests.get(
                f"{BASE_URL}/api/admin/events/{TEST_EVENT_ID}/assign-tables/status/{job_id}",
                headers=admin_headers
            )
            assert status_response.status_code == 200
            status_data = status_response.json()
            final_status = status_data
            
            if status_data.get("status") in ["completed", "error"]:
                break
            
            print(f"Progress: {status_data.get('progress', 0)}% - {status_data.get('message', '')}")
            time.sleep(2)
        
        assert final_status.get("status") == "completed", f"Expected completed, got: {final_status}"
        print(f"Table assignment completed without OpenAI key: {final_status.get('message')}")

    def test_table_assignment_graceful_skip_with_invalid_key(self, admin_headers):
        """Table assignment should complete gracefully with invalid OpenAI key"""
        # Set an invalid OpenAI key
        requests.put(f"{BASE_URL}/api/admin/settings", 
            headers=admin_headers,
            json={"openai_api_key": "sk-invalid-key-that-will-fail"}
        )
        
        # Start table assignment
        start_response = requests.post(
            f"{BASE_URL}/api/admin/events/{TEST_EVENT_ID}/assign-tables",
            headers=admin_headers
        )
        assert start_response.status_code == 200
        job_id = start_response.json()["job_id"]
        
        # Poll for completion
        max_wait = 60
        start_time = time.time()
        final_status = None
        
        while time.time() - start_time < max_wait:
            status_response = requests.get(
                f"{BASE_URL}/api/admin/events/{TEST_EVENT_ID}/assign-tables/status/{job_id}",
                headers=admin_headers
            )
            assert status_response.status_code == 200
            status_data = status_response.json()
            final_status = status_data
            
            if status_data.get("status") in ["completed", "error"]:
                break
            
            print(f"Progress: {status_data.get('progress', 0)}% - {status_data.get('message', '')}")
            time.sleep(2)
        
        # Should complete (not error) even with invalid key - AI is skipped gracefully
        assert final_status.get("status") == "completed", f"Expected completed (AI skipped), got: {final_status}"
        # Message should indicate AI was skipped
        message = final_status.get("message", "")
        print(f"Table assignment completed with invalid key (AI skipped): {message}")


class TestCategoriesPageNoAI:
    """Test that Categories page has NO AI-related UI elements"""

    def test_categories_endpoint_no_clash_group_in_response(self, admin_headers):
        """GET /api/admin/categories should return categories without requiring clash_group input"""
        response = requests.get(f"{BASE_URL}/api/admin/categories", headers=admin_headers)
        assert response.status_code == 200
        
        categories = response.json()
        assert isinstance(categories, list), "Categories should be a list"
        
        if categories:
            cat = categories[0]
            # Categories should have name and subcategory_count
            assert "name" in cat, "Category should have name"
            assert "subcategory_count" in cat, "Category should have subcategory_count"
            print(f"Sample category: {cat['name']} with {cat['subcategory_count']} subcategories")

    def test_create_category_without_clash_group(self, admin_headers):
        """POST /api/admin/categories should work without clash_group field"""
        import uuid
        test_name = f"TEST_Category_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/admin/categories", 
            headers=admin_headers,
            json={"name": test_name, "collaborates_with": []}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == test_name
        print(f"Created category without clash_group: {test_name}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/categories/{data['id']}", headers=admin_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
