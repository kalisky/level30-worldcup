import json
import re
from pathlib import Path
import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data"
SCRIPT_RESULTS_PATH = SCRIPT_DIR / "wc2026_results.json"
TIEBREAKS_PATH = SCRIPT_DIR / "group-tiebreaks.txt"
GROUP_STANDINGS_PATH = DATA_DIR / "group_standings.csv"
KNOCKOUT_BRACKET_PATH = DATA_DIR / "knockout_bracket.json"

def generate_tournament_files():
    # 1. Load match results
    with SCRIPT_RESULTS_PATH.open('r', encoding='utf-8') as f:
        data = json.load(f)
        
    # Extract the updated_time
    updated_time = data.get('updated_time', 'N/A')

    # 2. Parse FIFA rankings from text file
    rankings = {}
    with TIEBREAKS_PATH.open('r', encoding='utf-8') as f:
        for line in f:
            match = re.match(r'^(\d+),([^,]+),', line)
            if match:
                rank = int(match.group(1))
                country = match.group(2).strip()
                rankings[country] = rank

    name_map = {
        'Iran': 'IR Iran', 'Ivory Coast': "Côte d'Ivoire", 'Czech Republic': 'Czechia',
        'Turkey': 'Türkiye', 'Cape Verde': 'Cabo Verde', 'DR Congo': 'Congo DR',
        'South Korea': 'Korea Republic', 'United States': 'USA'
    }

    stats = {}
    
    # 3. Process matches
    for m in data.get('matches', []):
        grp = m['group']
        ht = m['home_team']
        at = m['away_team']
        
        score = m['score'].split('–')
        hg, ag = int(score[0]), int(score[1])
        
        for team in (ht, at):
            if team not in stats: 
                stats[team] = {'Group': grp, 'Pld': 0, 'W': 0, 'D': 0, 'L': 0, 'GF': 0, 'GA': 0, 'GD': 0, 'Pts': 0}
        
        stats[ht]['Pld'] += 1
        stats[at]['Pld'] += 1
        stats[ht]['GF'] += hg
        stats[at]['GF'] += ag
        stats[ht]['GA'] += ag
        stats[at]['GA'] += hg
        stats[ht]['GD'] += (hg - ag)
        stats[at]['GD'] += (ag - hg)
        
        if hg > ag:
            stats[ht]['W'] += 1; stats[ht]['Pts'] += 3; stats[at]['L'] += 1
        elif hg < ag:
            stats[at]['W'] += 1; stats[at]['Pts'] += 3; stats[ht]['L'] += 1
        else:
            stats[ht]['D'] += 1; stats[at]['D'] += 1
            stats[ht]['Pts'] += 1; stats[at]['Pts'] += 1

    teams_data = []
    for t, s in stats.items():
        s['Team'] = t
        s['Rank'] = rankings.get(name_map.get(t, t), 999) 
        teams_data.append(s)

    # 4. DataFrame & Sort
    df = pd.DataFrame(teams_data)
    df = df.sort_values(by=['Group', 'Pts', 'GD', 'GF', 'Rank'], ascending=[True, False, False, False, True])

    # Add the updated_time column for the CSV output
    df['Updated_Time'] = updated_time

    # 5. Extract 1st, 2nd, and 3rd Placements
    placements = {}
    third_place_teams = []

    for grp in "ABCDEFGHIJKL":
        grp_teams = df[df['Group'] == grp].to_dict('records')
        placements[f"1{grp}"] = grp_teams[0]['Team'] if len(grp_teams) > 0 else "TBD"
        placements[f"2{grp}"] = grp_teams[1]['Team'] if len(grp_teams) > 1 else "TBD"
        if len(grp_teams) > 2:
            third_place_teams.append(grp_teams[2])

    # Sort 3rd place teams to find top 8
    third_place_df = pd.DataFrame(third_place_teams)
    third_place_df = third_place_df.sort_values(by=['Pts', 'GD', 'GF', 'Rank'], ascending=[False, False, False, True])
    advancing_3rds = third_place_df.head(8)['Group'].tolist()
    
    # 6. Backtracking algorithm to map the 8 advancing groups to valid slots
    slots = {
        74: ['A', 'B', 'C', 'D', 'F'],
        77: ['C', 'D', 'F', 'G', 'H'],
        79: ['C', 'E', 'F', 'H', 'I'],
        80: ['E', 'H', 'I', 'J', 'K'],
        81: ['B', 'E', 'F', 'I', 'J'],
        82: ['A', 'E', 'H', 'I', 'J'],
        85: ['E', 'F', 'G', 'I', 'J'],
        87: ['D', 'E', 'I', 'J', 'L']
    }

    def allocate(match_ids, current_mapping, available):
        if not match_ids: return current_mapping
        match_id = match_ids[0]
        
        for option in [g for g in available if g in slots[match_id]]:
            new_mapping = current_mapping.copy()
            new_mapping[match_id] = option
            new_available = available.copy()
            new_available.remove(option)
            
            res = allocate(match_ids[1:], new_mapping, new_available)
            if res: return res
        return None

    allocation_map = allocate(list(slots.keys()), {}, advancing_3rds)

    def get_3rd_team(match_id):
        grp = allocation_map[match_id]
        return df[df['Group'] == grp].iloc[2]['Team']

    # Save CSV
    cols = ['Group', 'Team', 'Pld', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts', 'Rank', 'Updated_Time']
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df[cols].to_csv(GROUP_STANDINGS_PATH, index=False)
    print(f"✓ Standings successfully saved to '{GROUP_STANDINGS_PATH.relative_to(REPO_ROOT)}' (Updated: {updated_time})")

    # 7. Build Bracket JSON
    knockout_bracket = {
        "updated_time": updated_time,
        "round_of_32": [
            {"match": 73, "home": placements["2A"], "away": placements["2B"]},
            {"match": 74, "home": placements["1E"], "away": get_3rd_team(74)},
            {"match": 75, "home": placements["1F"], "away": placements["2C"]},
            {"match": 76, "home": placements["1C"], "away": placements["2F"]},
            {"match": 77, "home": placements["1I"], "away": get_3rd_team(77)},
            {"match": 78, "home": placements["2E"], "away": placements["2I"]},
            {"match": 79, "home": placements["1A"], "away": get_3rd_team(79)},
            {"match": 80, "home": placements["1L"], "away": get_3rd_team(80)},
            {"match": 81, "home": placements["1D"], "away": get_3rd_team(81)},
            {"match": 82, "home": placements["1G"], "away": get_3rd_team(82)},
            {"match": 83, "home": placements["2K"], "away": placements["2L"]},
            {"match": 84, "home": placements["1H"], "away": placements["2J"]},
            {"match": 85, "home": placements["1B"], "away": get_3rd_team(85)},
            {"match": 86, "home": placements["1J"], "away": placements["2H"]},
            {"match": 87, "home": placements["1K"], "away": get_3rd_team(87)},
            {"match": 88, "home": placements["2D"], "away": placements["2G"]}
        ],
        "round_of_16": [
            {"match": 89, "home": "Winner Match 74", "away": "Winner Match 77"},
            {"match": 90, "home": "Winner Match 73", "away": "Winner Match 75"},
            {"match": 91, "home": "Winner Match 76", "away": "Winner Match 78"},
            {"match": 92, "home": "Winner Match 79", "away": "Winner Match 80"},
            {"match": 93, "home": "Winner Match 83", "away": "Winner Match 84"},
            {"match": 94, "home": "Winner Match 81", "away": "Winner Match 82"},
            {"match": 95, "home": "Winner Match 86", "away": "Winner Match 88"},
            {"match": 96, "home": "Winner Match 85", "away": "Winner Match 87"}
        ],
        "quarter_finals": [
            {"match": 97, "home": "Winner Match 89", "away": "Winner Match 90"},
            {"match": 98, "home": "Winner Match 93", "away": "Winner Match 94"},
            {"match": 99, "home": "Winner Match 91", "away": "Winner Match 92"},
            {"match": 100, "home": "Winner Match 95", "away": "Winner Match 96"}
        ],
        "semi_finals": [
            {"match": 101, "home": "Winner Match 97", "away": "Winner Match 98"},
            {"match": 102, "home": "Winner Match 99", "away": "Winner Match 100"}
        ],
        "finals": [
            {"match": 103, "description": "Match for third place", "home": "Loser Match 101", "away": "Loser Match 102"},
            {"match": 104, "description": "Final", "home": "Winner Match 101", "away": "Winner Match 102"}
        ]
    }

    with KNOCKOUT_BRACKET_PATH.open('w', encoding='utf-8') as jf:
        json.dump(knockout_bracket, jf, indent=4)
    print(f"✓ Knockout bracket successfully saved to '{KNOCKOUT_BRACKET_PATH.relative_to(REPO_ROOT)}' (Updated: {updated_time})")

if __name__ == "__main__":
    generate_tournament_files()
