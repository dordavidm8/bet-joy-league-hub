import sys
import asyncio
import argparse
import os
import time
from playwright.async_api import async_playwright

AUTH_STORAGE_PATH = os.path.join(os.path.dirname(__file__), 'auth', 'notebooklm_cookies.json')

async def generate_podcast(source_text, output_path):
    async with async_playwright() as p:
        print(f"📡 Launching browser...")
        
        if not os.path.exists(AUTH_STORAGE_PATH):
            print(f"❌ ERROR: No auth state found at {AUTH_STORAGE_PATH}. Run auth first.")
            sys.exit(1)

        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=AUTH_STORAGE_PATH)
        page = await context.new_page()
        
        try:
            print(f"📡 Navigating to NotebookLM...")
            await page.goto("https://notebooklm.google.com/", timeout=60000)
            
            # 1. Create New Notebook
            print("🆕 Creating new notebook...")
            await page.click("text=Create new", timeout=30000)
            await asyncio.sleep(5)
            
            # 2. Add Source (Text)
            print("📝 Adding text source...")
            await page.click("text=Copied text", timeout=20000)
            await page.fill("textarea", source_text)
            await page.click("text=Insert", timeout=10000)
            await asyncio.sleep(5)
            
            # 3. Generate Audio Overview
            print("🎙️ Triggering Audio Overview generation...")
            # Use wait_for_selector instead of sleep to handle dynamic loading
            gen_btn = page.locator("button:has-text('Generate')").first
            await gen_btn.wait_for(state="visible", timeout=60000)
            await gen_btn.click()
            
            # 4. Wait for completion (Polling)
            print("⏳ Generation started. This usually takes 3-10 minutes. Polling...")
            start_time = time.time()
            max_wait = 15 * 60 # 15 minutes
            
            while time.time() - start_time < max_wait:
                # Use .first to avoid Strict Mode violation if multiple buttons match
                download_btn = page.locator("button:has-text('Download'), button[aria-label*='Download']").first
                if await download_btn.is_visible():
                    print("✅ Generation complete! Downloading...")
                    async with page.expect_download() as download_info:
                        await download_btn.click()
                    download = await download_info.value
                    await download.save_as(output_path)
                    print(f"🎉 Saved MP3 to {output_path}")
                    return
                
                # Check for specific failure indicators
                fail_indicator = page.locator("role=alert:has-text('failed'), .error-message:has-text('failed')").first
                if await fail_indicator.is_visible():
                    raise Exception("NotebookLM reported a generation failure in the UI.")
                    
                await asyncio.sleep(30)
                print(f"--- Still generating... ({int(time.time() - start_time)}s)")

            raise Exception("Timed out waiting for Audio Overview generation after 15 minutes.")
            
        except Exception as e:
            print(f"❌ Error during automation: {str(e)}")
            sys.exit(1)
        finally:
            await browser.close()

async def generate_slides(source_text, output_path):
    async with async_playwright() as p:
        print(f"📡 Launching browser for Slides...")

        if not os.path.exists(AUTH_STORAGE_PATH):
            print(f"❌ ERROR: No auth state found at {AUTH_STORAGE_PATH}. Run auth first.")
            sys.exit(1)

        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=AUTH_STORAGE_PATH)
        page = await context.new_page()

        try:
            print(f"📡 Navigating to NotebookLM...")
            await page.goto("https://notebooklm.google.com/", timeout=60000)

            # 1. Create New Notebook
            print("🆕 Creating new notebook...")
            await page.click("text=Create new", timeout=30000)
            await asyncio.sleep(5)

            # 2. Add Source (Text)
            print("📝 Adding text source...")
            await page.click("text=Copied text", timeout=20000)
            await page.fill("textarea", source_text)
            await page.click("text=Insert", timeout=10000)
            await asyncio.sleep(5)

            # 3. Open Studio and trigger Slide Deck generation
            print("🎞️ Opening Studio → Slide Deck...")
            studio_btn = page.locator("button:has-text('Studio'), [aria-label*='Studio']").first
            await studio_btn.wait_for(state="visible", timeout=60000)
            await studio_btn.click()

            slide_btn = page.locator("button:has-text('Slide'), [aria-label*='Slide']").first
            await slide_btn.wait_for(state="visible", timeout=30000)
            await slide_btn.click()

            gen_btn = page.locator("button:has-text('Generate')").first
            await gen_btn.wait_for(state="visible", timeout=30000)
            await gen_btn.click()

            # 4. Poll for Download
            print("⏳ Generating slides. Polling...")
            start_time = time.time()
            max_wait = 15 * 60

            while time.time() - start_time < max_wait:
                download_btn = page.locator("button:has-text('Download'), button[aria-label*='Download']").first
                if await download_btn.is_visible():
                    print("✅ Slides ready! Downloading...")
                    async with page.expect_download() as download_info:
                        await download_btn.click()
                    download = await download_info.value
                    await download.save_as(output_path)
                    print(f"🎉 Saved PDF to {output_path}")
                    return

                fail_indicator = page.locator("role=alert:has-text('failed'), .error-message:has-text('failed')").first
                if await fail_indicator.is_visible():
                    raise Exception("NotebookLM reported a slide generation failure in the UI.")

                await asyncio.sleep(30)
                print(f"--- Still generating... ({int(time.time() - start_time)}s)")

            raise Exception("Timed out waiting for Slide Deck generation after 15 minutes.")

        except Exception as e:
            print(f"❌ Error during slides automation: {str(e)}")
            sys.exit(1)
        finally:
            await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--mode", choices=["audio", "slides"], default="audio")
    args = parser.parse_args()

    if args.mode == "slides":
        asyncio.run(generate_slides(args.text, args.out))
    else:
        asyncio.run(generate_podcast(args.text, args.out))
