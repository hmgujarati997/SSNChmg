from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from database import db
import qrcode
import io

router = APIRouter(prefix="/api/public", tags=["Public"])


@router.get("/profile/{user_id}")
async def get_public_profile(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "User not found")
    if user.get('category_id'):
        cat = await db.categories.find_one({"id": user['category_id']}, {"_id": 0})
        user['category_name'] = cat['name'] if cat else ''
    if user.get('subcategory_id'):
        sub = await db.subcategories.find_one({"id": user['subcategory_id']}, {"_id": 0})
        user['subcategory_name'] = sub['name'] if sub else ''
    return user


@router.get("/qr/{user_id}")
async def get_qr_code(user_id: str, frontend_url: str = ""):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "User not found")
    url = f"{frontend_url}/profile/{user_id}" if frontend_url else user_id
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


@router.get("/vcard/{user_id}")
async def get_vcard(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "User not found")
    social = user.get('social_links', {})
    name = user.get('full_name', '')
    vcard = (
        "BEGIN:VCARD\r\n"
        "VERSION:3.0\r\n"
        f"FN:{name}\r\n"
        f"ORG:{user.get('business_name', '')}\r\n"
        f"TITLE:{user.get('position', '')}\r\n"
        f"TEL:{user.get('phone', '')}\r\n"
        f"EMAIL:{user.get('email', '')}\r\n"
        f"URL:{social.get('website', '')}\r\n"
        "END:VCARD\r\n"
    )
    return StreamingResponse(
        io.BytesIO(vcard.encode()),
        media_type="text/vcard",
        headers={"Content-Disposition": f"attachment; filename={name.replace(' ', '_')}.vcf"}
    )


@router.get("/categories")
async def get_public_categories():
    return await db.categories.find({}, {"_id": 0}).to_list(200)


@router.get("/subcategories")
async def get_public_subcategories(category_id: str = None):
    query = {}
    if category_id:
        query["category_id"] = category_id
    return await db.subcategories.find(query, {"_id": 0}).to_list(500)


@router.get("/events")
async def get_public_events():
    return await db.events.find({"registration_open": True}, {"_id": 0}).to_list(50)



@router.get("/branding")
async def get_branding():
    settings = await db.site_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = {}
    return {
        "header_logo": settings.get("header_logo", ""),
        "login_logo_1": settings.get("login_logo_1", ""),
        "login_logo_2": settings.get("login_logo_2", ""),
        "favicon": settings.get("favicon", ""),
        "pwa_icon": settings.get("pwa_icon", ""),
        "sponsor_logo_1": settings.get("sponsor_logo_1", ""),
        "sponsor_logo_2": settings.get("sponsor_logo_2", ""),
        "sponsor_name_1": settings.get("sponsor_name_1", ""),
        "sponsor_name_2": settings.get("sponsor_name_2", ""),
    }


@router.get("/dynamic-manifest.json")
async def dynamic_manifest():
    from fastapi.responses import JSONResponse
    settings = await db.site_settings.find_one({"id": "default"}, {"_id": 0})
    has_pwa = settings and settings.get("pwa_icon")
    has_fav = settings and settings.get("favicon")
    icons = []
    if has_fav:
        icons.append({"src": "/api/uploads/favicon-32.png", "sizes": "32x32", "type": "image/png"})
    else:
        icons.append({"src": "/favicon-32.png", "sizes": "32x32", "type": "image/png"})
    if has_pwa:
        icons.append({"src": "/api/uploads/pwa-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"})
        icons.append({"src": "/api/uploads/pwa-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"})
    else:
        icons.append({"src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"})
        icons.append({"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"})
    return JSONResponse({
        "short_name": "SSNC",
        "name": "SSNC - Speed Networking",
        "icons": icons,
        "start_url": "/",
        "display": "standalone",
        "theme_color": "#32329A",
        "background_color": "#ffffff",
        "orientation": "portrait"
    })
