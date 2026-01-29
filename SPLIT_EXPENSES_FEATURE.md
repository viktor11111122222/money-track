# Split Expenses Feature Documentation

## Overview
The Split Expenses feature has been fully implemented to allow users to:
- Create split expenses with multiple people
- Specify individual amounts for each person in the split
- View a detailed breakdown of who owes what
- Add friends or custom members to splits
- Automatically calculate total amounts

## Features Implemented

### 1. **Split Creation Modal**
- New form section in the shared modal for creating splits
- Bill/expense name input
- Total amount display (auto-calculated from member amounts)
- Member breakdown section with individual amounts

### 2. **Member Management**
- **Add Friends**: Click "+ Add Friend" button to select from existing friends list
- **Custom Members**: Add members manually by typing their name
- **Per-Person Amounts**: Each member has their own amount field
- **Easy Removal**: Remove members with the × button

### 3. **Smart Amount Calculation**
- **Auto-Calculation**: When you enter an amount and have members, it distributes equally
- **Manual Override**: Edit individual member amounts directly
- **Total Sync**: Total amount auto-updates as you modify member amounts

### 4. **Split Display**
- Shows split name and all members
- Displays a breakdown showing exactly how much each person owes
- Shows total split amount prominently
- Organized in the "Split Expenses" section

### 5. **Backend Support**
- Database schema updated to store per-member amounts as JSON
- API endpoints support `memberAmounts` object with member: amount pairs
- Consistent data persistence across sessions

## How to Use

### Creating a Split

1. **Click "Split Bill"** button in the Split Expenses card or "New Split" button
2. **Enter Bill Name** (e.g., "Restaurant Bill", "Road Trip")
3. **Add Members**:
   - Click "+ Add Friend" to select from your friends list
   - Or type a custom member name
4. **Set Amounts**:
   - Enter the total amount, or
   - Enter individual amounts for each person (total auto-calculates)
5. **Click "Create Split"** to save

### Viewing Splits

All created splits appear in the "Split Expenses" section with:
- Bill name
- List of all members
- Detailed breakdown of who owes what
- Total amount in RSD

## Example Use Cases

### Equal Split
- Restaurant bill for 3 people: 9,000 RSD
- Enter amount: 9,000 RSD
- Add 3 members
- System auto-splits: 3,000 RSD each

### Unequal Split
- Grocery shopping: 5,000 RSD total
- Ana: 2,500 RSD
- Marko: 1,500 RSD  
- Ivana: 1,000 RSD
- Each person's amount is recorded separately

## Technical Details

### Database Changes
- Added `member_amounts` column to splits table
- Stores JSON object: `{"Ana": 2500, "Marko": 1500}`

### API Endpoints
```
POST /api/splits
Body: {
  name: string,
  amount: number,
  members: string[],
  memberAmounts: object (member: amount pairs)
}

GET /api/splits
Returns: Array of splits with memberAmounts
```

### Frontend Components
- `splitMembers`: Object tracking current form members
- `renderSplitMembersBreakdown()`: Renders member input fields
- `addSplitMember()`: Adds a member to the split
- `updateSplitTotalAmount()`: Recalculates total
- `showSplitMemberPicker()`: Shows friend selection menu
- `renderSplits()`: Displays all splits with breakdown

### Styling
- Split member rows with input fields
- Green breakdown display showing member amounts
- Responsive design matching app theme
- Smooth interactions and animations

## Files Modified

1. **backend/db.js**
   - Added migration for `member_amounts` column

2. **backend/server.js**
   - Updated GET /api/splits endpoint
   - Updated POST /api/splits endpoint to handle memberAmounts

3. **shared/index.html**
   - Added splitMembersBreakdownRow section
   - Added form fields for split members and amounts

4. **shared/script.js**
   - Added splitMembers tracking variable
   - Added helper functions: renderSplitMembersBreakdown, addSplitMember, updateSplitTotalAmount, showSplitMemberPicker
   - Updated setModalMode to handle split initialization
   - Updated handleSubmit to send memberAmounts
   - Added event listeners for member picker and amount changes
   - Enhanced renderSplits to show breakdown

5. **shared/style.css**
   - Added styles for split member rows
   - Added styles for split breakdown display
   - Added styles for member picker menu
   - Responsive and accessible styling

## Future Enhancements

Potential improvements for future versions:
- Edit existing splits
- Delete splits
- Mark splits as "settled"
- History of split transactions
- Settlement suggestions (who needs to pay whom)
- Multiple split types (percentage-based, custom ratios)
- Export split summaries
- Payment tracking and reminders
