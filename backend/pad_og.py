from PIL import Image

input_path = '/Users/nirdahan/.gemini/antigravity/brain/613645b4-0047-4c7b-9c3f-b8d91d35e207/kickoff_light_framed_icon_1776777866968.png'
output_path = '/Users/nirdahan/Documents/Projects/bet-joy-league-hub/public/og_image_light.jpg'

try:
    img = Image.open(input_path).convert('RGB')
    
    # Get the background color from top-left pixel (0, 0)
    bg_color = img.getpixel((0, 0))
    
    # Resize the image down to height 630 if it's larger
    # Actually wait! The generated image is exactly the icon. Wait, the WA preview crops out the 1200x630.
    target_height = 630
    target_width = 1200
    
    # Let's scale original image to height 630
    aspect_ratio = img.width / img.height
    new_width = int(target_height * aspect_ratio)
    
    img = img.resize((new_width, target_height), Image.Resampling.LANCZOS)
    
    # Create new blank image with the background color
    padded_img = Image.new('RGB', (target_width, target_height), bg_color)
    
    # Paste the resized image into the center
    paste_x = (target_width - new_width) // 2
    padded_img.paste(img, (paste_x, 0))
    
    padded_img.save(output_path, 'JPEG', quality=95)
    print("Successfully created perfectly padded image.")
except Exception as e:
    print("Error:", e)
