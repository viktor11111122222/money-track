# 📍 Project Navigation Guide

## Quick Links to Key Files

### 🚀 Start Here (Read First!)
- **00_START_HERE.md** - Quick overview of the feature
- **IMPLEMENTATION_COMPLETE.md** - Summary of what was built

### 📖 Documentation (Pick What You Need)

**For Users:**
- **QUICK_START.md** - Step-by-step guide to use the feature
- **SPLIT_EXPENSES_FEATURE.md** - Detailed feature documentation

**For Developers:**
- **IMPLEMENTATION_SUMMARY.md** - Technical architecture
- **CHANGELOG.md** - Complete list of code changes
- **README_SPLIT_EXPENSES.md** - Comprehensive overview

**For Quality Assurance:**
- **VALIDATION_REPORT.md** - Testing and validation details

---

## 📂 Modified Code Files

### Backend Code
- **backend/db.js** - Database schema changes
- **backend/server.js** - API endpoint updates

### Frontend Code  
- **shared/index.html** - New form sections
- **shared/script.js** - Feature logic (largest changes)
- **shared/style.css** - Styling for split components

### Supporting Code (May Have Other Updates)
- dashboard/
- expenses/
- public/

---

## 🔍 Finding Specific Changes

### "Where did you add the split form?"
→ Look in **shared/index.html** around line 242
→ Search for `splitMembersBreakdownRow`

### "How does the automatic calculation work?"
→ See **shared/script.js**
→ Functions: `updateSplitTotalAmount()` and event listeners

### "What's the database structure?"
→ Check **backend/db.js** line 72
→ See migration for `member_amounts` column

### "How does the API work?"
→ See **backend/server.js**
→ Endpoints: `GET /api/splits` and `POST /api/splits`

### "What's the styling?"
→ Check **shared/style.css** at the end
→ Classes: `.split-members-breakdown`, `.split-member-row`, etc.

---

## 💻 Running the Application

### 1. Start Backend
```bash
cd /Users/vica/Desktop/money-track-1/backend
node server.js
# You should see: "Backend running on http://localhost:4000"
```

### 2. Access Frontend
```
Open browser to: http://127.0.0.1:5500/shared/index.html
```

### 3. Test the Feature
```
1. Log in to Family Budget
2. Click "Split Bill" button
3. Follow the form to create a split
4. View splits in the list below
```

---

## 📋 Documentation Map

```
00_START_HERE.md
    ↓
    ├─→ QUICK_START.md (User Guide)
    │
    ├─→ IMPLEMENTATION_COMPLETE.md (Summary)
    │
    ├─→ SPLIT_EXPENSES_FEATURE.md (Features)
    │
    ├─→ IMPLEMENTATION_SUMMARY.md (Technical)
    │
    ├─→ CHANGELOG.md (Code Changes)
    │
    ├─→ README_SPLIT_EXPENSES.md (Complete)
    │
    └─→ VALIDATION_REPORT.md (QA)
```

---

## 🎯 Use Cases

### "I want to use the feature"
1. Read: **QUICK_START.md**
2. Go to Family Budget section
3. Click "Split Bill"
4. Follow the form

### "I want to understand how it works"
1. Read: **SPLIT_EXPENSES_FEATURE.md**
2. Check: **README_SPLIT_EXPENSES.md**

### "I want to see the code changes"
1. Read: **CHANGELOG.md**
2. Look at: **shared/script.js** (main logic)
3. Check: **shared/index.html** (form structure)

### "I want technical details"
1. Read: **IMPLEMENTATION_SUMMARY.md**
2. Review: **backend/server.js** (API)
3. Check: **backend/db.js** (Database)

### "I want to verify quality"
1. Read: **VALIDATION_REPORT.md**
2. Check: **Testing Performed** section

---

## 🔑 Key Sections by File

### shared/script.js (Most Important)
- Line 147: `let splitMembers = {}`
- Line 868: `function showSplitMemberPicker()`
- Line 937: `function renderSplitMembersBreakdown()`
- Line 999: `function addSplitMember()`
- Line 1005: `function updateSplitTotalAmount()`
- Line 1013: `function renderSplits()` (enhanced)
- Line 1120: `if (currentType === 'split')` (form submission)

### backend/server.js (API)
- Line 406: `GET /api/splits` endpoint
- Line 422: `POST /api/splits` endpoint

### shared/index.html (Form)
- Line 242: Split members breakdown section
- Line 246: "+ Add Friend" button

### shared/style.css (Styling)
- Line 167: `.ghost.small` button
- Line 1120: Split component styling

---

## ✅ Quality Checklist

Before using the feature, verify:
- [ ] Backend is running (`node server.js`)
- [ ] Frontend is accessible (localhost:5500)
- [ ] You can see "Split Bill" button
- [ ] Modal opens when clicking the button
- [ ] Can add members
- [ ] Can set amounts
- [ ] Can save splits
- [ ] Splits appear in list with breakdown

---

## 📞 Getting Help

1. **Can't find something?** → Use this navigation guide
2. **How do I use it?** → Read QUICK_START.md
3. **How does it work?** → Read SPLIT_EXPENSES_FEATURE.md
4. **What code changed?** → Check CHANGELOG.md
5. **Is it working?** → See VALIDATION_REPORT.md

---

## 🎊 Conclusion

Everything you need to understand, use, and maintain the Split Expenses feature is documented and organized in the root directory.

**Start with: `00_START_HERE.md`**

Then choose your path:
- **User?** → QUICK_START.md
- **Developer?** → IMPLEMENTATION_SUMMARY.md
- **QA?** → VALIDATION_REPORT.md

---

**Happy Exploring!** 🚀
