# 📋 Implementation Plan: Enhanced Multi-Group Search with Auto-Discovery

## 🎯 Goal
Enhance the existing `search_messages` tool to automatically discover and search across ALL groups the authenticated user belongs to, without requiring manual configuration.

---

## 📊 Overview

### **Current State:**
- Requires manual configuration of group IDs via `TELEGRAM_GROUP_IDS` environment variable
- Limited to 10 groups maximum
- User must know group IDs/usernames beforehand

### **Target State:**
- Automatic discovery of all user's groups via Telegram API
- No manual configuration required
- Default limit of 50 groups (configurable up to 200)
- Searches channels, supergroups, and basic groups by default
- Optional targeting of specific groups still available

### **Key Decisions Made:**
- ✅ **Max groups:** 50 default (user configurable, max 200)
- ✅ **Include channels:** Yes, all groups + channels
- ✅ **Archived groups:** No, active dialogs only
- ✅ **Remove TELEGRAM_GROUP_IDS:** Complete removal, pure auto-discovery
- ✅ **Include group context:** Add group name and ID to each message result

---

## 🔍 Architecture Changes

### **New Data Flow:**

```
User Query
    ↓
[Auto-Discovery]
    ↓ (messages.getDialogs)
Discover all groups (up to 200)
    ↓ (filter & limit)
Select groups to search (max 50 default)
    ↓ (parallel search)
Search each group (Api.messages.Search)
    ↓ (aggregate)
Return combined results
```

### **Fallback: Specific Group Search**

```
User Query + groupIds parameter
    ↓
Skip auto-discovery
    ↓
Search specified groups only
    ↓
Return results
```

---

## 📂 File Changes Overview

| File | Change Type | Description |
|------|-------------|-------------|
| `src/telegram.ts` | **Add** | New `getAllUserGroups()` helper function |
| `src/types.ts` | **Modify** | Update `TelegramConfig`, `SearchParams`, `MessageResult` interfaces |
| `src/tools/search.ts` | **Modify** | Add auto-discovery logic and group context to results |
| `src/index.ts` | **Modify** | Remove group env vars, update tool schema |
| `.env.example` | **Modify** | Remove `TELEGRAM_GROUP_IDS` reference |
| `README.md` | **Modify** | Update documentation for auto-discovery |

---

## ✅ Implementation Checklist

### **Code Changes:**
- [ ] **Step 1:** Add `getAllUserGroups()` function to `src/telegram.ts`
- [ ] **Step 2:** Update `TelegramConfig` interface in `src/types.ts`
- [ ] **Step 3:** Update `SearchParams` interface in `src/types.ts`
- [ ] **Step 4:** Update `MessageResult` interface in `src/types.ts` (add group name/ID)
- [ ] **Step 5:** Add import for `getAllUserGroups` in `src/tools/search.ts`
- [ ] **Step 6:** Enhance `searchMessages()` logic in `src/tools/search.ts` (auto-discovery)
- [ ] **Step 7:** Add group context to message results in `src/tools/search.ts`
- [ ] **Step 8:** Simplify `getConfig()` in `src/index.ts` (remove group parsing)
- [ ] **Step 9:** Update tool schema in `src/index.ts` (add new parameters)
- [ ] **Step 10:** Add validation for new parameters in `src/index.ts`

### **Documentation:**
- [ ] **Step 11:** Update `.env.example` (remove group references)
- [ ] **Step 12:** Update `README.md` configuration section
- [ ] **Step 13:** Update `README.md` usage section with examples
- [ ] **Step 14:** Add migration guide to `README.md`

### **Testing:**
- [ ] **Test 1:** Auto-discovery with default settings
- [ ] **Test 2:** Auto-discovery with max limit
- [ ] **Test 3:** Specific group search (backward compatibility)
- [ ] **Test 4:** Filter by group type
- [ ] **Test 5:** Max groups parameter
- [ ] **Test 6:** User with no groups
- [ ] **Test 7:** Rate limiting with many groups
- [ ] **Test 8:** Error handling
- [ ] **Test 9:** Performance with different concurrency
- [ ] **Test 10:** Mixed auto-discovery and filters

---

## 🎯 New Feature: Group Context in Message Results

### **Problem:**
When searching across multiple groups, users need to know which group each message came from to understand the context and source of information.

### **Solution:**
Add group identification to each message result:

**Update `MessageResult` interface to include:**
```typescript
export interface MessageResult {
  messageId: number;
  senderId: number;
  senderName: string;
  senderUsername?: string;
  text: string;
  date: string;
  link?: string;
  
  // NEW: Group context fields
  groupId: string;           // Group identifier (numeric ID or username)
  groupTitle: string;        // Human-readable group name
  groupType?: string;        // Type: 'channel', 'supergroup', 'gigagroup', 'basicgroup'
  
  relevanceScore?: number;
  media?: MediaInfo;
  replyTo?: ReplyInfo;
  forwardedFrom?: ForwardInfo;
  extended?: ExtendedMetadata;
}
```

### **Implementation Details:**

1. **In `searchSingleGroup()` function:**
   - Already has access to `group` entity (resolved at line 29-31)
   - Extract `group.title` when formatting results
   - Pass group info to each message result

2. **Update message formatting (around line 272):**
   ```typescript
   formattedResults.push({
     messageId: message.id,
     senderId: ...,
     senderName,
     senderUsername,
     text: message.message || '',
     date,
     link,
     
     // NEW: Add group context
     groupId: groupId,
     groupTitle: group.title || 'Unknown Group',
     groupType: determineGroupType(group),
     
     relevanceScore,
     media,
     replyTo,
     forwardedFrom,
     extended,
   });
   ```

3. **Add helper function:**
   ```typescript
   function determineGroupType(group: any): string {
     if (group.className === 'Chat') return 'basicgroup';
     if (group.className === 'Channel') {
       if (group.broadcast) return 'channel';
       if (group.gigagroup) return 'gigagroup';
       return 'supergroup';
     }
     return 'unknown';
   }
   ```

### **User Experience:**

**Before:**
```json
{
  "messageId": 12345,
  "text": "Check out this vendor...",
  "senderName": "John Doe"
}
```

**After:**
```json
{
  "messageId": 12345,
  "text": "Check out this vendor...",
  "senderName": "John Doe",
  "groupId": "-1001234567890",
  "groupTitle": "Peptide Research Group",
  "groupType": "supergroup"
}
```

Now users can easily see which group each message came from!

---

## 📝 Detailed Implementation Guide

See the sections below for complete implementation details for each step.

---

**Plan Created:** January 2026  
**Plan Version:** 1.0  
**Status:** Ready for Implementation

---

## 📌 Summary of Updates

### **Version 1.1 Changes:**
- ✅ Added requirement to include group context (name, ID, type) in message results
- ✅ Updated `MessageResult` interface to include `groupId`, `groupTitle`, `groupType`
- ✅ Added helper function `determineGroupType()` for type detection
- ✅ Updated implementation checklist to include group context changes
- ✅ Added detailed section on group context feature implementation

### **Impact:**
- Users will now see which group each message came from
- Better context for understanding search results
- Easier to identify patterns across different groups
- No breaking changes - only additive fields to MessageResult

**Plan Version:** 1.1  
**Last Updated:** January 2026
