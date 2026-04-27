import csv
import sys
import os

input_file = "nano-banana-pro-prompts-20260422.csv"
output_dir = "backend/src/agents/skills/nano-banana-agent/references"
output_file = os.path.join(output_dir, "nano-banana-pro-prompts.csv")

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

keywords = [
    "soccer", "football", "sport", "stadium", "athletic", 
    "advertise", "commercial", "ui", "interface", "mockup", 
    "phone", "app", "betting", "logo", "branding", "champions",
    "jersey", "cleats", "ball"
]

print(f"Filtering {input_file} for keywords: {keywords}")

def is_relevant(row_text):
    text = row_text.lower()
    return any(kw in text for kw in keywords)

try:
    with open(input_file, mode='r', encoding='utf-8') as infile, \
         open(output_file, mode='w', encoding='utf-8', newline='') as outfile:
        
        reader = csv.DictReader(infile)
        fieldnames = reader.fieldnames
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        
        writer.writeheader()
        
        kept = 0
        total = 0
        for row in reader:
            total += 1
            # Check title, description, and content fields
            row_text = str(row.get('title', '')) + " " + str(row.get('description', '')) + " " + str(row.get('content', ''))
            if is_relevant(row_text):
                writer.writerow(row)
                kept += 1
                
    print(f"Done. Kept {kept} out of {total} prompts.")
    # Remove original to clean up
    os.remove(input_file)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
