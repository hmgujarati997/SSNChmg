import requests
import sys
import json
from datetime import datetime

class SSNCAPITester:
    def __init__(self, base_url="https://ssnc-meet-track.preview.emergentagent.com"):
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

    def test_user_registration_mandatory_business_info(self):
        """Test user registration with mandatory business info validation"""
        # Test 1: Registration without business_name should fail
        user_data_no_business = {
            "full_name": "Test User",
            "phone": f"9876543{datetime.now().strftime('%H%M')}",
            "email": f"testuser{datetime.now().strftime('%H%M%S')}@test.com",
            "business_name": "",  # Empty business name
            "category_id": self.created_category_id or "",
            "subcategory_id": "",
            "position": "Test Position"
        }
        
        success, response = self.run_test(
            "User Registration - Missing Business Name (Should Fail)",
            "POST",
            "auth/user/register",
            400,  # Should fail
            data=user_data_no_business
        )
        
        # Test 2: Registration without category should fail
        user_data_no_category = {
            "full_name": "Test User 2",
            "phone": f"9876544{datetime.now().strftime('%H%M')}",
            "email": f"testuser2{datetime.now().strftime('%H%M%S')}@test.com",
            "business_name": "Test Business",
            "category_id": "",  # Empty category
            "subcategory_id": "",
            "position": "Test Position"
        }
        
        success2, response2 = self.run_test(
            "User Registration - Missing Category (Should Fail)",
            "POST",
            "auth/user/register",
            400,  # Should fail
            data=user_data_no_category
        )
        
        # Test 3: Valid registration with all required fields
        user_data_valid = {
            "full_name": "Test User Valid",
            "phone": f"9876545{datetime.now().strftime('%H%M')}",
            "email": f"testuser3{datetime.now().strftime('%H%M%S')}@test.com",
            "business_name": "Test Business Valid",
            "category_id": self.created_category_id or "",
            "subcategory_id": "",
            "position": "Test Position"
        }
        
        success3, response3 = self.run_test(
            "User Registration - Valid Data",
            "POST",
            "auth/user/register",
            200,
            data=user_data_valid
        )
        
        if success3 and 'token' in response3:
            self.user_token = response3['token']
            if 'user' in response3 and 'id' in response3['user']:
                self.created_user_id = response3['user']['id']
                print(f"   User created with ID: {self.created_user_id}")
        
        return success and success2 and success3

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

    def test_admin_create_user_with_event_registration(self):
        """Test admin creating user with optional event registration"""
        if not self.admin_token:
            print("❌ Skipping - No admin token")
            return False
        
        user_data = {
            "full_name": "Admin Created User",
            "phone": f"9876546{datetime.now().strftime('%H%M')}",
            "email": f"adminuser{datetime.now().strftime('%H%M%S')}@test.com",
            "business_name": "Admin Test Business",
            "category_id": self.created_category_id or "",
            "subcategory_id": "",
            "position": "Admin Test Position",
            "event_id": self.created_event_id or ""
        }
        
        success, response = self.run_test(
            "Admin Create User with Event Registration",
            "POST",
            "admin/users",
            200,
            data=user_data,
            token=self.admin_token
        )
        return success

    def test_admin_users_list_with_business_info(self):
        """Test admin users list includes business info"""
        if not self.admin_token:
            print("❌ Skipping - No admin token")
            return False
        
        success, response = self.run_test(
            "Admin Users List with Business Info",
            "GET",
            "admin/users",
            200,
            token=self.admin_token
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            # Check if users have business info fields
            user = response[0]
            has_business_fields = all(field in user for field in ['business_name', 'category_name'])
            if has_business_fields:
                print("   ✅ Users list includes business info fields")
                return True
            else:
                print("   ❌ Users list missing business info fields")
                return False
        return success

    def test_event_registrations_with_business_info(self):
        """Test event registrations include business info"""
        if not self.admin_token or not self.created_event_id:
            print("❌ Skipping - No admin token or event")
            return False
        
        success, response = self.run_test(
            "Event Registrations with Business Info",
            "GET",
            f"admin/events/{self.created_event_id}/registrations",
            200,
            token=self.admin_token
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} registrations")
            if len(response) > 0:
                # Check if registrations have business info
                reg = response[0]
                if 'user' in reg and reg['user']:
                    user = reg['user']
                    has_business_fields = 'business_name' in user
                    if has_business_fields:
                        print("   ✅ Event registrations include business info")
                        return True
                    else:
                        print("   ❌ Event registrations missing business info")
                        return False
        return success

    def test_profile_completion_status(self):
        """Test profile completion status check"""
        if not self.user_token:
            print("❌ Skipping - No user token")
            return False
        
        success, response = self.run_test(
            "Profile Completion Status",
            "GET",
            "user/profile-status",
            200,
            token=self.user_token
        )
        
        if success and 'complete' in response:
            print(f"   Profile complete: {response['complete']}")
            if 'missing_fields' in response:
                print(f"   Missing fields: {response['missing_fields']}")
            return True
        return success

    def test_incomplete_user_login(self):
        """Test login with user that has incomplete profile (phone: 1111111111)"""
        success, response = self.run_test(
            "Incomplete User Login",
            "POST",
            "auth/user/login",
            200,
            data={"phone": "1111111111", "password": "1111111111"}
        )
        
        if success and 'token' in response:
            # Check profile status for this user
            incomplete_token = response['token']
            success2, response2 = self.run_test(
                "Incomplete User Profile Status",
                "GET",
                "user/profile-status",
                200,
                token=incomplete_token
            )
            
            if success2 and 'complete' in response2:
                is_complete = response2['complete']
                print(f"   Profile complete: {is_complete}")
                if not is_complete:
                    print("   ✅ Correctly identified incomplete profile")
                    return True
                else:
                    print("   ❌ Profile should be incomplete but shows as complete")
                    return False
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
        tester.test_user_registration_mandatory_business_info,
        tester.test_user_login,
        tester.test_create_volunteer,
        tester.test_volunteer_login,
        tester.test_list_users,
        tester.test_list_volunteers,
        tester.test_user_profile,
        tester.test_user_events,
        tester.test_admin_settings,
        tester.test_admin_create_user_with_event_registration,
        tester.test_admin_users_list_with_business_info,
        tester.test_event_registrations_with_business_info,
        tester.test_profile_completion_status,
        tester.test_incomplete_user_login,
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