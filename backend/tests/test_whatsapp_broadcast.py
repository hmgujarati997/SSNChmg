"""
WhatsApp Broadcast Feature Tests
Tests for background job processing, job polling, and status endpoints
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EVENT_ID = "06e81655-7341-4435-a3c3-5e2b9f691f18"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/admin/login",
        json={"email": "admin@ssnc.com", "password": "admin123"}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture
def auth_headers(admin_token):
    """Headers with admin auth token"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestWhatsAppStatusEndpoint:
    """Tests for GET /api/admin/whatsapp/status/{event_id}"""
    
    def test_status_returns_200(self, auth_headers):
        """Status endpoint returns 200 for valid event"""
        response = requests.get(
            f"{BASE_URL}/api/admin/whatsapp/status/{TEST_EVENT_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        
    def test_status_has_welcome_section(self, auth_headers):
        """Status response includes 'welcome' sub-object"""
        response = requests.get(
            f"{BASE_URL}/api/admin/whatsapp/status/{TEST_EVENT_ID}",
            headers=auth_headers
        )
        data = response.json()
        assert "welcome" in data
        assert "total" in data["welcome"]
        assert "sent" in data["welcome"]
        assert "failed" in data["welcome"]
        assert "messages" in data["welcome"]
        
    def test_status_has_assignment_section(self, auth_headers):
        """Status response includes 'assignment' sub-object"""
        response = requests.get(
            f"{BASE_URL}/api/admin/whatsapp/status/{TEST_EVENT_ID}",
            headers=auth_headers
        )
        data = response.json()
        assert "assignment" in data
        assert "total" in data["assignment"]
        assert "sent" in data["assignment"]
        assert "failed" in data["assignment"]
        assert "messages" in data["assignment"]
        
    def test_status_has_overall_counts(self, auth_headers):
        """Status response includes overall total/sent/failed counts"""
        response = requests.get(
            f"{BASE_URL}/api/admin/whatsapp/status/{TEST_EVENT_ID}",
            headers=auth_headers
        )
        data = response.json()
        assert "total" in data
        assert "sent" in data
        assert "failed" in data
        
    def test_status_requires_auth(self):
        """Status endpoint requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/admin/whatsapp/status/{TEST_EVENT_ID}"
        )
        assert response.status_code in [401, 403]


class TestSendWelcomeEndpoint:
    """Tests for POST /api/admin/whatsapp/send-welcome/{event_id}"""
    
    def test_send_welcome_returns_job_id(self, auth_headers):
        """Send welcome returns job_id for background processing"""
        response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/send-welcome/{TEST_EVENT_ID}?template_name=welcome",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data
        assert len(data["job_id"]) > 0
        
    def test_send_welcome_returns_total(self, auth_headers):
        """Send welcome returns total count of users to process"""
        response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/send-welcome/{TEST_EVENT_ID}?template_name=welcome",
            headers=auth_headers
        )
        data = response.json()
        assert "total" in data
        assert isinstance(data["total"], int)
        
    def test_send_welcome_returns_already_sent(self, auth_headers):
        """Send welcome returns count of already sent messages"""
        response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/send-welcome/{TEST_EVENT_ID}?template_name=welcome",
            headers=auth_headers
        )
        data = response.json()
        assert "already_sent" in data
        
    def test_send_welcome_requires_auth(self):
        """Send welcome requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/send-welcome/{TEST_EVENT_ID}?template_name=welcome"
        )
        assert response.status_code in [401, 403]
        
    def test_send_welcome_invalid_event(self, auth_headers):
        """Send welcome returns 404 for invalid event"""
        response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/send-welcome/invalid-event-id?template_name=welcome",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestSendAssignmentsEndpoint:
    """Tests for POST /api/admin/whatsapp/send-assignments/{event_id}"""
    
    def test_send_assignments_returns_job_id(self, auth_headers):
        """Send assignments returns job_id for background processing"""
        response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/send-assignments/{TEST_EVENT_ID}?template_name=table_assignment",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data
        assert len(data["job_id"]) > 0
        
    def test_send_assignments_returns_total(self, auth_headers):
        """Send assignments returns total count of users"""
        response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/send-assignments/{TEST_EVENT_ID}?template_name=table_assignment",
            headers=auth_headers
        )
        data = response.json()
        assert "total" in data
        assert isinstance(data["total"], int)
        
    def test_send_assignments_requires_auth(self):
        """Send assignments requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/send-assignments/{TEST_EVENT_ID}?template_name=table_assignment"
        )
        assert response.status_code in [401, 403]


class TestJobPollingEndpoint:
    """Tests for GET /api/admin/whatsapp/job/{job_id}"""
    
    def test_job_polling_returns_status(self, auth_headers):
        """Job polling returns status field"""
        # First start a job
        start_response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/send-welcome/{TEST_EVENT_ID}?template_name=welcome",
            headers=auth_headers
        )
        job_id = start_response.json().get("job_id")
        
        # Poll the job
        response = requests.get(
            f"{BASE_URL}/api/admin/whatsapp/job/{job_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] in ["running", "completed", "not_found"]
        
    def test_job_polling_returns_progress_fields(self, auth_headers):
        """Job polling returns total, sent, failed, processed fields"""
        # Start a job
        start_response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/send-welcome/{TEST_EVENT_ID}?template_name=welcome",
            headers=auth_headers
        )
        job_id = start_response.json().get("job_id")
        
        # Wait a bit for processing to start
        time.sleep(1)
        
        # Poll the job
        response = requests.get(
            f"{BASE_URL}/api/admin/whatsapp/job/{job_id}",
            headers=auth_headers
        )
        data = response.json()
        
        if data.get("status") != "not_found":
            assert "total" in data
            assert "sent" in data
            assert "failed" in data
            assert "processed" in data
            
    def test_job_polling_progress_increases(self, auth_headers):
        """Job polling shows increasing processed count over time"""
        # Start a job
        start_response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/send-welcome/{TEST_EVENT_ID}?template_name=welcome",
            headers=auth_headers
        )
        job_id = start_response.json().get("job_id")
        
        # Poll twice with delay
        time.sleep(0.5)
        poll1 = requests.get(
            f"{BASE_URL}/api/admin/whatsapp/job/{job_id}",
            headers=auth_headers
        ).json()
        
        time.sleep(2)
        poll2 = requests.get(
            f"{BASE_URL}/api/admin/whatsapp/job/{job_id}",
            headers=auth_headers
        ).json()
        
        # Processed count should increase (or job completed)
        if poll1.get("status") == "running" and poll2.get("status") == "running":
            assert poll2.get("processed", 0) >= poll1.get("processed", 0)
            
    def test_job_polling_invalid_job(self, auth_headers):
        """Job polling returns not_found for invalid job_id"""
        response = requests.get(
            f"{BASE_URL}/api/admin/whatsapp/job/invalid-job-id",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "not_found"
        
    def test_job_polling_requires_auth(self):
        """Job polling requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/admin/whatsapp/job/some-job-id"
        )
        assert response.status_code in [401, 403]


class TestRetryFailedEndpoint:
    """Tests for POST /api/admin/whatsapp/retry-failed/{event_id}"""
    
    def test_retry_failed_returns_job_id(self, auth_headers):
        """Retry failed returns job_id for background processing"""
        response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/retry-failed/{TEST_EVENT_ID}?message_type=welcome&template_name=welcome",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # Either returns job_id (if there are failed messages) or message about no failed
        assert "job_id" in data or "retried" in data
        
    def test_retry_failed_returns_total(self, auth_headers):
        """Retry failed returns total count of messages to retry"""
        response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/retry-failed/{TEST_EVENT_ID}?message_type=welcome&template_name=welcome",
            headers=auth_headers
        )
        data = response.json()
        assert "total" in data or "retried" in data
        
    def test_retry_failed_requires_auth(self):
        """Retry failed requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/retry-failed/{TEST_EVENT_ID}?message_type=welcome&template_name=welcome"
        )
        assert response.status_code in [401, 403]


class TestBackgroundProcessingNoTimeout:
    """Tests to verify background processing handles large user counts without HTTP timeout"""
    
    def test_send_welcome_returns_immediately(self, auth_headers):
        """Send welcome returns immediately (< 5 seconds) even for 496 users"""
        import time
        start = time.time()
        response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/send-welcome/{TEST_EVENT_ID}?template_name=welcome",
            headers=auth_headers,
            timeout=10
        )
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 5, f"Request took {elapsed}s, should return immediately"
        
    def test_send_assignments_returns_immediately(self, auth_headers):
        """Send assignments returns immediately (< 5 seconds) even for many users"""
        import time
        start = time.time()
        response = requests.post(
            f"{BASE_URL}/api/admin/whatsapp/send-assignments/{TEST_EVENT_ID}?template_name=table_assignment",
            headers=auth_headers,
            timeout=10
        )
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 5, f"Request took {elapsed}s, should return immediately"
