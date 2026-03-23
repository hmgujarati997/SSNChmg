import requests
import sys
import json
from datetime import datetime

class SSNCAPITester:
    def __init__(self, base_url="https://networking-hub-6.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.volunteer_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_user_id = None
        self.created_event_id = None
        self.created_category_id = None
        self.created_volunteer_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/admin/login",
            200,
            data={"email": "admin@ssnc.com", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   Admin token obtained")
            return True
        return False

    def test_admin_dashboard_stats(self):
        """Test admin dashboard stats"""
        if not self.admin_token:
            print("❌ Skipping - No admin token")
            return False
        
        success, response = self.run_test(
            "Admin Dashboard Stats",
            "GET",
            "admin/dashboard/stats",
            200,
            token=self.admin_token
        )
        return success

    def test_create_category(self):
        """Test creating a business category"""
        if not self.admin_token:
            print("❌ Skipping - No admin token")
            return False
        
        success, response = self.run_test(
            "Create Category",
            "POST",
            "admin/categories",
            200,
            data={"name": "Technology", "description": "Tech companies"},
            token=self.admin_token
        )
        if success and 'id' in response:
            self.created_category_id = response['id']
            print(f"   Category created with ID: {self.created_category_id}")
        return success

    def test_list_categories(self):
        """Test listing categories"""
        if not self.admin_token:
            print("❌ Skipping - No admin token")
            return False
        
        success, response = self.run_test(
            "List Categories",
            "GET",
            "admin/categories",
            200,
            token=self.admin_token
        )
        return success

    def test_create_event(self):
        """Test creating an event"""
        if not self.admin_token:
            print("❌ Skipping - No admin token")
            return False
        
        event_data = {
            "name": "Test Speed Networking Event",
            "date": "2026-02-15",
            "time": "18:00",
            "venue": "Test Venue",
            "total_tables": 10,
            "total_rounds": 5,
            "round_duration": 10,
            "payment_type": "manual",
            "payment_link": "",
            "description": "Test event for API testing"
        }
        
        success, response = self.run_test(
            "Create Event",
            "POST",
            "admin/events",
            200,
            data=event_data,
            token=self.admin_token
        )
        if success and 'id' in response:
            self.created_event_id = response['id']
            print(f"   Event created with ID: {self.created_event_id}")
        return success

    def test_list_events(self):
        """Test listing events"""
        if not self.admin_token:
            print("❌ Skipping - No admin token")
            return False
        
        success, response = self.run_test(
            "List Events",
            "GET",
            "admin/events",
            200,
            token=self.admin_token
        )
        return success

    def test_user_registration(self):
        """Test user registration"""
        user_data = {
            "full_name": "Test User",
            "phone": f"9876543{datetime.now().strftime('%H%M')}",  # Unique phone
            "email": f"testuser{datetime.now().strftime('%H%M%S')}@test.com",
            "business_name": "Test Business",
            "category_id": self.created_category_id or "",
            "subcategory_id": "",
            "position": "Test Position",
            "password": "testpass123"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/user/register",
            200,
            data=user_data
        )
        if success and 'token' in response:
            self.user_token = response['token']
            if 'user' in response and 'id' in response['user']:
                self.created_user_id = response['user']['id']
                print(f"   User created with ID: {self.created_user_id}")
            return True
        return False

    def test_user_login(self):
        """Test user login with created user"""
        if not self.created_user_id:
            print("❌ Skipping - No user created")
            return False
        
        # Use phone number as password (default behavior)
        phone = f"9876543{datetime.now().strftime('%H%M')}"
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/user/login",
            200,
            data={"phone": phone, "password": "testpass123"}
        )
        if success and 'token' in response:
            self.user_token = response['token']
            return True
        return False

    def test_create_volunteer(self):
        """Test creating a volunteer"""
        if not self.admin_token:
            print("❌ Skipping - No admin token")
            return False
        
        volunteer_data = {
            "name": "Test Volunteer",
            "phone": f"8765432{datetime.now().strftime('%H%M')}",
            "email": f"volunteer{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "volpass123"
        }
        
        success, response = self.run_test(
            "Create Volunteer",
            "POST",
            "admin/volunteers",
            200,
            data=volunteer_data,
            token=self.admin_token
        )
        if success and 'id' in response:
            self.created_volunteer_id = response['id']
            print(f"   Volunteer created with ID: {self.created_volunteer_id}")
        return success

    def test_volunteer_login(self):
        """Test volunteer login"""
        if not self.created_volunteer_id:
            print("❌ Skipping - No volunteer created")
            return False
        
        phone = f"8765432{datetime.now().strftime('%H%M')}"
        success, response = self.run_test(
            "Volunteer Login",
            "POST",
            "auth/volunteer/login",
            200,
            data={"phone": phone, "password": "volpass123"}
        )
        if success and 'token' in response:
            self.volunteer_token = response['token']
            return True
        return False

    def test_list_users(self):
        """Test listing users"""
        if not self.admin_token:
            print("❌ Skipping - No admin token")
            return False
        
        success, response = self.run_test(
            "List Users",
            "GET",
            "admin/users",
            200,
            token=self.admin_token
        )
        return success

    def test_list_volunteers(self):
        """Test listing volunteers"""
        if not self.admin_token:
            print("❌ Skipping - No admin token")
            return False
        
        success, response = self.run_test(
            "List Volunteers",
            "GET",
            "admin/volunteers",
            200,
            token=self.admin_token
        )
        return success

    def test_user_profile(self):
        """Test getting user profile"""
        if not self.user_token:
            print("❌ Skipping - No user token")
            return False
        
        success, response = self.run_test(
            "Get User Profile",
            "GET",
            "user/profile",
            200,
            token=self.user_token
        )
        return success

    def test_user_events(self):
        """Test getting available events for user"""
        if not self.user_token:
            print("❌ Skipping - No user token")
            return False
        
        success, response = self.run_test(
            "Get User Events",
            "GET",
            "user/events",
            200,
            token=self.user_token
        )
        return success

    def test_admin_settings(self):
        """Test getting admin settings"""
        if not self.admin_token:
            print("❌ Skipping - No admin token")
            return False
        
        success, response = self.run_test(
            "Get Admin Settings",
            "GET",
            "admin/settings",
            200,
            token=self.admin_token
        )
        return success

def main():
    print("🚀 Starting SSNC Speed Networking API Tests")
    print("=" * 50)
    
    tester = SSNCAPITester()
    
    # Core API tests
    tests = [
        tester.test_health_check,
        tester.test_admin_login,
        tester.test_admin_dashboard_stats,
        tester.test_create_category,
        tester.test_list_categories,
        tester.test_create_event,
        tester.test_list_events,
        tester.test_user_registration,
        tester.test_user_login,
        tester.test_create_volunteer,
        tester.test_volunteer_login,
        tester.test_list_users,
        tester.test_list_volunteers,
        tester.test_user_profile,
        tester.test_user_events,
        tester.test_admin_settings,
    ]
    
    # Run all tests
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())