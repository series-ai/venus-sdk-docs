# Popups API

## Venus Popups API

{% include "../../../../.gitbook/includes/popups-api-description.md" %}

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.initializeAsync()

await VenusAPI.popups.showToast('Progress saved!', {
  duration: 3000,
  variant: 'success',
  action: { label: 'Undo', onPress: undoSave },
})
```

### Dialog Patterns

*   **Alert:** simple acknowledgement.

    ```typescript
    await VenusAPI.popups.showAlert('Warning', 'This cannot be undone', {
      buttonText: 'OK',
    })
    ```
*   **Confirm:** yield boolean decisions.

    ```typescript
    const confirmed = await VenusAPI.popups.showConfirm(
      'Delete item?',
      'Are you sure you want to destroy this relic?',
      { confirmText: 'Delete', cancelText: 'Cancel' },
    )
    ```
*   **Action Sheet:** multiple options with optional cancel.

    ```typescript
    const selected = await VenusAPI.popups.showActionSheet(
      [
        { id: 'edit', label: 'Edit' },
        { id: 'share', label: 'Share' },
      ],
      { title: 'Choose Action', cancelButtonText: 'Cancel' },
    )
    ```

### Best Practices

* Keep copy short and actionable; long text is truncated on mobile.
* Avoid stacking popups—await each promise before launching the next.
* Prefer toast notifications for non-blocking feedback to maintain flow.
