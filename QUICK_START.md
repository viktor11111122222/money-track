# Split Expenses - Quick Start Guide

## Getting Started

### Prerequisites
- Backend server running on `http://localhost:4000`
- Frontend accessible on `http://127.0.0.1:5500` (or your local server)
- User logged in to the Family Budget section

### Starting the Backend

```bash
cd /Users/vica/Desktop/money-track-1/backend
node server.js
```

You should see: `Backend running on http://localhost:4000`

## Using Split Expenses

### 1️⃣ Create Your First Split

1. Navigate to **Family Budget** section
2. Click **"Split Bill"** button in the Split Expenses card
3. Enter a bill name (e.g., "Dinner with Friends")
4. A form will open in the modal

### 2️⃣ Add Members

**Option A - From Your Friends List:**
- Click **"+ Add Friend"** button
- Select a friend from the dropdown menu
- Friend appears with an amount field

**Option B - Custom Member:**
- Click **"+ Add Friend"** → **"+ Custom member..."**
- Type a name (e.g., "Ana", "Marko")
- Click to add

### 3️⃣ Set Amounts

**Method 1 - Auto Equal Split:**
1. Enter total amount (e.g., 9000)
2. Add all members
3. Click elsewhere - amounts auto-calculate!
4. Each member gets: 9000 ÷ 3 = 3000 RSD

**Method 2 - Manual Amounts:**
1. Add all members first
2. Click each member's amount field
3. Enter exact amount (e.g., Ana: 2500, Marko: 3000, Ivana: 3500)
4. Total updates automatically: 9000 RSD

**Method 3 - Mixed:**
1. Enter total amount
2. Add members → auto-splits equally
3. Adjust individual amounts as needed
4. Total recalculates on change

### 4️⃣ Remove Members

- Click the **✕** button next to any member
- They're removed instantly
- Total recalculates

### 5️⃣ Save the Split

- Click **"Create Split"** button
- Modal closes
- Split appears in the **"Split Expenses"** section below

## Viewing Your Splits

All splits appear in the **"Split Expenses"** section with:
- 📋 Bill name
- 👥 List of members
- 💰 Breakdown box (green) showing exact amounts
- 💵 Total amount

## Common Scenarios

### Scenario: Restaurant Bill
```
Bill: "Restaurant Lunch"
Amount: 6000 RSD
Members: Ana, Marko, Ivana
→ Each owes: 2000 RSD
```

### Scenario: Shared Apartment Expenses
```
Bill: "Utilities & Internet"
Amount: 6000 RSD
- Ana: 2500 (uses most)
- Marko: 1500 (less usage)
- Ivana: 2000 (medium usage)
→ Shows exact amounts owed
```

### Scenario: Road Trip
```
Bill: "Gas & Tolls"
Amount: 4500 RSD
- Ana: 1500 (driving mostly)
- Marko: 1500 (driving/gas)
- Ivana: 1500 (passenger)
→ Equal split, fair contribution
```

## Tips & Tricks

💡 **Tip 1**: If you don't have a member in your friends list, use "Custom member" option to add anyone

💡 **Tip 2**: You can adjust amounts after auto-split calculates them - just change the numbers!

💡 **Tip 3**: The breakdown box shows exactly how much each person owes - great for confirming before saving

💡 **Tip 4**: Total amount is calculated from individual amounts - it updates in real-time

💡 **Tip 5**: All splits are saved to your account - they persist across sessions

## Troubleshooting

### "Please add at least one member" error
✅ **Solution**: Click "+ Add Friend" and select or enter a member name before saving

### Amounts not adding up
✅ **Solution**: Check that all member amount fields are filled with numbers (not blank)

### Total showing 0 RSD
✅ **Solution**: Enter amounts in member fields OR enter total amount with members added (it auto-splits)

### Split not appearing
✅ **Solution**: Refresh the page or wait a moment - it should appear immediately below

### Member picker not showing friends
✅ **Solution**: You may not have any friends added yet. Use "Custom member" option instead

## Data Storage

- All splits stored in SQLite database
- Linked to your user account
- Persists across sessions
- Secure and private to your account

## Example Workflow

```
1. ✅ Click "Split Bill" button
2. ✅ Enter "Movie Night" as bill name
3. ✅ Click "+ Add Friend", select "Marko"
4. ✅ Click "+ Add Friend", select "Ana"  
5. ✅ Enter "2000" as total amount
6. ✅ Members auto-get: 1000 each (2000 ÷ 2)
7. ✅ Click "Create Split"
8. ✅ See split in list with breakdown showing:
        Marko: 1000 RSD
        Ana: 1000 RSD
        Total: 2000 RSD
```

## Next Steps

After creating splits:
- Create more splits for different events
- Add friends to your account for faster selection
- Use the dashboard to track all expenses

---

**Need Help?** Check the detailed documentation in `SPLIT_EXPENSES_FEATURE.md`

Enjoy splitting expenses! 🎉
