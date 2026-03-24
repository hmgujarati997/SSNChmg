from pydantic import BaseModel
from typing import List, Optional


class AdminLogin(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    phone: str
    password: str


class VolunteerLogin(BaseModel):
    phone: str
    password: str


class CategoryCreate(BaseModel):
    name: str
    collaborates_with: List[str] = []


class SubCategoryCreate(BaseModel):
    name: str
    category_id: str


class EventCreate(BaseModel):
    name: str
    date: str
    time: str
    venue: str
    registration_fee: float = 0
    payment_type: str = "manual"
    payment_link: str = ""
    total_tables: int = 10
    chairs_per_table: int = 8
    total_rounds: int = 3
    vacant_seats_per_table: int = 1
    round_duration_minutes: int = 10
    speaker_time_seconds: int = 60


class EventUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    venue: Optional[str] = None
    registration_fee: Optional[float] = None
    payment_type: Optional[str] = None
    payment_link: Optional[str] = None
    total_tables: Optional[int] = None
    chairs_per_table: Optional[int] = None
    total_rounds: Optional[int] = None
    vacant_seats_per_table: Optional[int] = None
    round_duration_minutes: Optional[int] = None
    speaker_time_seconds: Optional[int] = None
    registration_open: Optional[bool] = None


class UserCreate(BaseModel):
    full_name: str
    phone: str
    email: str = ""
    business_name: str = ""
    category_id: str = ""
    subcategory_id: str = ""
    position: str = ""
    profile_picture: str = ""
    company_logo: str = ""
    linkedin: str = ""
    instagram: str = ""
    twitter: str = ""
    youtube: str = ""
    whatsapp: str = ""
    facebook: str = ""
    website: str = ""
    password: str = ""


class AdminUserCreate(BaseModel):
    full_name: str
    phone: str
    email: str = ""
    business_name: str = ""
    category_id: str = ""
    subcategory_id: str = ""
    position: str = ""
    password: str = ""
    event_id: str = ""  # optional: auto-register for event


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    business_name: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    position: Optional[str] = None
    profile_picture: Optional[str] = None
    company_logo: Optional[str] = None
    linkedin: Optional[str] = None
    instagram: Optional[str] = None
    twitter: Optional[str] = None
    youtube: Optional[str] = None
    whatsapp: Optional[str] = None
    facebook: Optional[str] = None
    website: Optional[str] = None


class VolunteerCreate(BaseModel):
    name: str
    phone: str
    email: str = ""
    password: str


class TableCaptainAssign(BaseModel):
    event_id: str
    user_id: str
    table_number: int


class ReferenceCreate(BaseModel):
    event_id: str
    to_user_id: str
    round_number: int
    table_number: int = 0
    notes: str = ""
    contact_name: str = ""
    contact_phone: str = ""
    contact_email: str = ""


class SiteSettingsUpdate(BaseModel):
    admin_email: Optional[str] = None
    admin_password: Optional[str] = None
    live_screen_password: Optional[str] = None
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None


class LiveAuthRequest(BaseModel):
    password: str


class RoundControl(BaseModel):
    action: str
    round_number: int = 0
