## Design

```json
{
    "paths": {
        "/": {
            "notes": ["note_id_1", "note_id_2"]
        },
        "/life/colleges": {
            "notes": ["note_id_3", "note_id_4"]
        },
    },
    "note_metadata": {
        "note_id_1": {
            "metadata": "metadata_encrypted_hex",
            "version": 1
        }
    },
    "custom_notes_order_creation_desc": ["note_id_3", "note_id_2", "note_id_1"]
    "custom_notes_order_creation_asc": ["note_id_1", "note_id_2", "note_id_3"]
}
```

### Metadata

#### v1

```json
{
    "title": "Note 1",
    "path": "/life/colleges"
}
```
