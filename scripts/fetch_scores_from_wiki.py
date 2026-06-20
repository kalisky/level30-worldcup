import requests
from bs4 import BeautifulSoup
import re
import string
import json
import datetime

print("Fetching World Cup 2026 data...")

headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
matches_data = []

def parse_goals(goal_text):
    """
    Parses goals and attaches the correct scorer, resilient to formatting artifacts.
    """
    clean_text = re.sub(r'\[.*?\]', '', goal_text)
    goals_array = []
    
    pattern = r"(\d+(?:\+\d+)?)['’](?:\s*\((.*?)\))?"
    
    current_player = "Unknown"
    last_end = 0
    
    for match in re.finditer(pattern, clean_text):
        prefix = clean_text[last_end:match.start()].strip()
        
        # BULLETPROOF FIX: Strip out stray numbers, brackets, and commas from the front
        cleaned_prefix = re.sub(r'^[\s,\]\d]+', '', prefix)
        cleaned_prefix = cleaned_prefix.strip(',').strip()
        
        if cleaned_prefix:
            current_player = cleaned_prefix
            
        minute = match.group(1)
        modifier = match.group(2) or ""
        
        is_penalty = "pen" in modifier.lower()
        is_own_goal = "o.g" in modifier.lower() or "og" in modifier.lower()
        
        goals_array.append({
            "scorer": current_player,
            "minute": minute,
            "penalty": is_penalty,
            "own-goal": is_own_goal
        })
        
        last_end = match.end()
        
    return goals_array

# Loop through Groups A to L
for letter in string.ascii_uppercase[:12]: 
    url = f"https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_{letter}"
    
    try:
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')

        matches = soup.find_all(['table', 'div'], class_='footballbox')
        
        for match in matches:
            try:
                home_team = match.find(class_='fhome').get_text(strip=True)
                away_team = match.find(class_='faway').get_text(strip=True)
                score = match.find(class_='fscore').get_text(strip=True)
                
                if not re.search(r'\d+\s*[–-]\s*\d+', score):
                    continue
                    
                goal_cells = match.find_all(class_='fgoals')
                home_goals_str = ""
                away_goals_str = ""
                
                if len(goal_cells) >= 1:
                    home_goals_str = goal_cells[0].get_text(separator=" ", strip=True)
                if len(goal_cells) >= 2:
                    away_goals_str = goal_cells[1].get_text(separator=" ", strip=True)
                    
                # BULLETPROOF FIX: Explicitly consume any spaces or digits inside the Report brackets
                if "Report" in home_goals_str and not away_goals_str:
                    parts = re.split(r'\[?\s*Report[\s\d]*\]?', home_goals_str, flags=re.IGNORECASE)
                    home_goals_str = parts[0]
                    if len(parts) > 1:
                        away_goals_str = parts[1]

                matches_data.append({
                    "group": letter,
                    "home_team": home_team,
                    "away_team": away_team,
                    "score": score,
                    "home_goals": parse_goals(home_goals_str),
                    "away_goals": parse_goals(away_goals_str)
                })
                
            except AttributeError:
                continue
                
    except Exception as e:
        print(f"Error fetching Group {letter}: {e}")

output_filename = "wc2026_results.json"
with open(output_filename, "w", encoding="utf-8") as f:
    json.dump({"updated_time": datetime.datetime.now().isoformat(), "matches": matches_data}, f, indent=4, ensure_ascii=False)

print(f"Success! {len(matches_data)} matches saved to {output_filename}")