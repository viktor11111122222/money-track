# 🎨 Split Expenses - Visual Guide

## User Interface Layout

### Split Creation Modal
```
┌─────────────────────────────────────────┐
│           New Split                  [X] │
├─────────────────────────────────────────┤
│                                         │
│  Bill name *                            │
│  [Restaurant Lunch_____________]        │
│                                         │
│  Amount (RSD) *                         │
│  [9000____________________]              │
│                                         │
│  Members & Amounts                      │
│  ┌──────────────────────────────────┐   │
│  │ Ana          [3000]    [✕]       │   │
│  │ Marko        [3000]    [✕]       │   │
│  │ Ivana        [3000]    [✕]       │   │
│  └──────────────────────────────────┘   │
│                                         │
│  [+ Add Friend]                         │
│                                         │
│  [Cancel]  [Create Split]               │
└─────────────────────────────────────────┘
```

### Split List Display
```
Split Expenses Section
├─ [+ New Split]
│
├─ Restaurant Lunch
│  Ana, Marko, Ivana
│  ┌─────────────────────────┐
│  │ Ana: 3,000 RSD          │ ← Green Breakdown
│  │ Marko: 3,000 RSD        │
│  │ Ivana: 3,000 RSD        │
│  └─────────────────────────┘
│  Total: 9,000 RSD
│
└─ Road Trip Expenses
   Marko, Ivana
   ┌──────────────────────────┐
   │ Marko: 6,000 RSD         │
   │ Ivana: 4,000 RSD         │
   └──────────────────────────┘
   Total: 10,000 RSD
```

---

## User Workflow

### Scenario 1: Equal Split

```
User clicks "Split Bill"
        ↓
Modal opens with form
        ↓
User enters:
  - Bill name: "Restaurant"
  - Amount: 9,000 RSD
        ↓
User clicks "+ Add Friend"
        ↓
Dropdown shows:
  ☐ Ana
  ☐ Marko  
  ☐ Ivana
        ↓
User selects Ana, Marko, Ivana
        ↓
System auto-calculates:
  Ana: 3,000
  Marko: 3,000
  Ivana: 3,000
        ↓
User clicks "Create Split"
        ↓
Split saved and displayed in list
```

### Scenario 2: Unequal Split

```
User clicks "+ Add Friend"
        ↓
Adds: Marko, Ivana, Petar
        ↓
Instead of entering total, user enters:
  Marko: 4,000
  Ivana: 3,000
  Petar: 2,000
        ↓
System auto-calculates:
  Total: 9,000 RSD
        ↓
User clicks "Create Split"
        ↓
Split shows exact breakdown
```

---

## Data Flow Diagram

```
Frontend (User Input)
    ↓
JavaScript Processing
    ├─ splitMembers object
    ├─ Form validation
    └─ Calculate totals
    ↓
API Call (POST /api/splits)
    ├─ name: "Restaurant"
    ├─ amount: 9000
    ├─ members: ["Ana", "Marko"]
    └─ memberAmounts: {"Ana": 4500, "Marko": 4500}
    ↓
Backend Processing
    ├─ User authentication
    ├─ Data validation
    └─ JSON stringification
    ↓
Database Storage (SQLite)
    ├─ Insert into splits table
    ├─ Link to user_id
    └─ Store memberAmounts as JSON
    ↓
API Response
    └─ Return created split object
    ↓
Frontend Display
    ├─ Add to splitsList
    ├─ Call renderSplits()
    └─ Show with breakdown
    ↓
User sees split in "Split Expenses" section
```

---

## Calculation Logic

### Equal Split Example
```
User Input:
  Total Amount: 9,000 RSD
  Members: Ana, Marko, Ivana (3 people)

Calculation:
  Per Person = Total ÷ Number of Members
  Per Person = 9,000 ÷ 3
  Per Person = 3,000 RSD

Result:
  Ana: 3,000 RSD
  Marko: 3,000 RSD
  Ivana: 3,000 RSD
  Total: 9,000 RSD ✓
```

### Unequal Split Example
```
User Input:
  Ana: 2,500 RSD
  Marko: 3,500 RSD
  Ivana: 3,000 RSD

Calculation:
  Total = Sum of all amounts
  Total = 2,500 + 3,500 + 3,000
  Total = 9,000 RSD

Result:
  Ana: 2,500 RSD
  Marko: 3,500 RSD
  Ivana: 3,000 RSD
  Total: 9,000 RSD ✓
```

---

## Form State Management

```
splitMembers Object Structure:
{
  "Ana": 3000,      ← Member name: Amount
  "Marko": 2500,
  "Ivana": 3500
}

When user adds member:
  ↓
addSplitMember("Ana")
  ↓
splitMembers["Ana"] = 0
  ↓
renderSplitMembersBreakdown()
  ↓
Form shows: [Ana] [0] [✕]

When user changes amount:
  ↓
splitMembers["Ana"] = 3000
  ↓
updateSplitTotalAmount()
  ↓
Total updates to 3000

When user removes member:
  ↓
delete splitMembers["Ana"]
  ↓
renderSplitMembersBreakdown()
  ↓
Ana row disappears
```

---

## Database Structure

```
SQLite Table: splits

┌──────────────────────────────────────────────────┐
│ Column           │ Type    │ Description          │
├──────────────────────────────────────────────────┤
│ id               │ INTEGER │ Primary Key          │
│ owner_id         │ INTEGER │ User who created     │
│ name             │ TEXT    │ Bill name            │
│ amount           │ REAL    │ Total amount         │
│ members          │ TEXT    │ "Ana|Marko|Ivana"    │
│ member_amounts   │ TEXT    │ JSON amounts         │
│ created_at       │ INTEGER │ Timestamp            │
└──────────────────────────────────────────────────┘

Example member_amounts JSON:
{
  "Ana": 3000,
  "Marko": 3000,
  "Ivana": 3000
}
```

---

## API Request/Response

### Create Split (POST /api/splits)

**Request:**
```json
{
  "name": "Restaurant Lunch",
  "amount": 9000,
  "members": ["Ana", "Marko", "Ivana"],
  "memberAmounts": {
    "Ana": 3000,
    "Marko": 3000,
    "Ivana": 3000
  }
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Restaurant Lunch",
  "amount": 9000,
  "members": ["Ana", "Marko", "Ivana"],
  "memberAmounts": {
    "Ana": 3000,
    "Marko": 3000,
    "Ivana": 3000
  },
  "created_at": 1706489400000
}
```

### Get All Splits (GET /api/splits)

**Response:**
```json
[
  {
    "id": 1,
    "name": "Restaurant Lunch",
    "amount": 9000,
    "members": ["Ana", "Marko"],
    "memberAmounts": {
      "Ana": 4500,
      "Marko": 4500
    },
    "created_at": 1706489400000
  },
  {
    "id": 2,
    "name": "Road Trip",
    "amount": 6000,
    "members": ["Marko", "Ivana"],
    "memberAmounts": {
      "Marko": 4000,
      "Ivana": 2000
    },
    "created_at": 1706489500000
  }
]
```

---

## Styling Color Scheme

```
Component          Color        Use Case
─────────────────────────────────────────
Ghost Button       #CBD5F5      Secondary actions
Primary Button     #111827      Main actions
Member Input       #DBEAFE      Input fields
Member Name        #1E293B      Text labels
Breakdown BG       #F0FDF4      Amount display
Breakdown Border   #22C55E      Green highlight
Remove Button      #FEE2E2      Danger actions
Remove Hover       #FECACA      Danger hover
Input Focus        #3B82F6      Active state
```

---

## Responsive Design

```
Desktop (> 1024px):
┌────────────────────────────────────────┐
│  Split Members Form                    │
│  ┌──────────────────────────────────┐  │
│  │ Name    Amount    Remove          │  │
│  │ Ana     [3000]    [✕]           │  │
│  │ Marko   [3000]    [✕]           │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘

Tablet (768px - 1024px):
┌────────────────────────────┐
│  Split Members Form        │
│  ┌──────────────────────┐  │
│  │ Ana    [3000]  [✕]   │  │
│  │ Marko  [3000]  [✕]   │  │
│  └──────────────────────┘  │
└────────────────────────────┘

Mobile (< 768px):
┌──────────────────────┐
│ Split Members        │
│ ┌──────────────────┐ │
│ │ Ana              │ │
│ │ [3000]  [✕]      │ │
│ │ Marko            │ │
│ │ [3000]  [✕]      │ │
│ └──────────────────┘ │
└──────────────────────┘
```

---

## Error Handling

```
Validation Flow:

User submits form
    ↓
┌─ Bill name empty?
│  └─→ "Please enter a bill name"
│
├─ No members added?
│  └─→ "Please add at least one member"
│
├─ Invalid amount?
│  └─→ "Amount must be a valid number"
│
└─ All valid?
   └─→ API call → Save to database
       ↓
       Success → Show in list
       Error → "Failed to save split"
```

---

## Accessibility Features

```
✓ Form labels linked to inputs
✓ Keyboard navigation support
✓ Clear visual hierarchy
✓ Color not sole indicator
✓ Focus states visible
✓ Error messages clear
✓ Responsive design
✓ Standard HTML elements
```

---

**End of Visual Guide**

This diagram helps visualize how the Split Expenses feature works!
