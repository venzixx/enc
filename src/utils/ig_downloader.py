import sys
import json
import os
import re
import urllib.request
import instaloader

def extract_shortcode(url):
    url = url.strip()
    match = re.search(r'instagram\.com/(?:p|reel|reels|tv|share)/([A-Za-z0-9_-]+)', url)
    if match:
        return match.group(1)
    match_general = re.search(r'instagram\.com/([A-Za-z0-9_-]+)', url)
    if match_general:
        return match_general.group(1)
    return url

def fetch_instagram_media(url_or_shortcode):
    shortcode = extract_shortcode(url_or_shortcode)
    
    # 1. Try Instaloader (no cookies)
    is_restricted = False
    try:
        L = instaloader.Instaloader(
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False
        )
        
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        
        results = []
        caption = post.caption or ""
        
        if post.typename == 'GraphSidecar':
            for node in post.get_sidecar_nodes():
                if node.is_video and node.video_url:
                    results.append({'type': 'video', 'url': node.video_url})
                elif node.display_url:
                    results.append({'type': 'image', 'url': node.display_url})
            return {
                'success': True,
                'type': 'slides',
                'caption': caption,
                'media': results
            }
        elif post.is_video and post.video_url:
            return {
                'success': True,
                'type': 'video',
                'caption': caption,
                'media': [{'type': 'video', 'url': post.video_url}]
            }
        else:
            return {
                'success': True,
                'type': 'image',
                'caption': caption,
                'media': [{'type': 'image', 'url': post.url}]
            }
    except Exception as inst_err:
        err_str = str(inst_err)
        err_type = type(inst_err).__name__
        if any(keyword in err_type or keyword in err_str.lower() for keyword in ['login', 'private', '401', '403', 'badresponse', 'restricted']):
            is_restricted = True

    # 2. Fallback: Query Instagram Embed / Public GraphQL Endpoint
    try:
        embed_url = f"https://www.instagram.com/p/{shortcode}/embed/captioned/"
        req = urllib.request.Request(
            embed_url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            
            # Find images in embed page
            img_matches = re.findall(r'class="EmbeddedMediaImage"[^>]*src="([^"]+)"', html)
            if not img_matches:
                img_matches = re.findall(r'<img[^>]+src="([^"]+)"[^>]*class="[^"]*EmbeddedMediaImage', html)
                
            if img_matches:
                # Unescape &amp;
                img_url = img_matches[0].replace('&amp;', '&')
                return {
                    'success': True,
                    'type': 'image',
                    'caption': '',
                    'media': [{'type': 'image', 'url': img_url}]
                }
    except Exception:
        pass

    return {
        'success': False,
        'is_age_restricted': is_restricted,
        'error': 'This video is age-restricted or from a private account' if is_restricted else f'Unable to fetch Instagram post {shortcode}'
    }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No URL provided'}))
        sys.exit(1)
        
    url = sys.argv[1]
    result = fetch_instagram_media(url)
    print(json.dumps(result))
