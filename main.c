// main.c
// Laundry Management System in C
// Features: Add/Delete Clothes, Manage Laundry, Handle Lost/Missing Items

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define MAX_CLOTHES 100
#define MAX_NAME 50
#define MAX_CATEGORY 20
#define MAX_IMAGE 128
#define MAX_LAST_WASHED 16
#define MAX_HISTORY_LINES 10 // Max number of laundry history records to keep

// Status strings for consistency
#define STATUS_PENDING "Pending"
#define STATUS_NONE "None"
#define STATUS_NEVER "Never"

struct Cloth {
    char name[MAX_NAME];
    char category[MAX_CATEGORY];
    int is_missing;
    int in_laundry;
    char lost_date[16];
    char image[MAX_IMAGE];
    char last_washed[MAX_LAST_WASHED];
};

struct Cloth closet[MAX_CLOTHES];
int closet_count = 0;

// Categories
const char* categories[] = {
    "Shirt", "T-shirt", "Pants", "Jeans", "Kurta", "Pyjama", "Towels", "Bed Sheets", "Pillow Covers", "Shorts"
};
const int NUM_CATEGORIES = 10;

// Utility: Get today's date as string
void get_today(char *buf, size_t sz) {
    time_t t = time(NULL);
    struct tm tm = *localtime(&t);
    snprintf(buf, sz, "%04d-%02d-%02d", tm.tm_year + 1900, tm.tm_mon + 1, tm.tm_mday);
}

// Build closet filename for a user
void get_closet_filename(const char *username, char *filename, size_t size) {
    snprintf(filename, size, "closet_%s.txt", username);
}

// Build laundry history filename for a user
void get_laundry_history_filename(const char *username, char *filename, size_t size) {
    snprintf(filename, size, "laundry_history_%s.txt", username);
}

// Load closet from file for a user
void load_closet_from_file(const char *username) {
    char filename[128];
    get_closet_filename(username, filename, sizeof(filename));
    FILE *f = fopen(filename, "r");
    if (!f) return; // File doesn't exist yet, which is fine.

    closet_count = 0;
    char line[512];
    while (fgets(line, sizeof(line), f) && closet_count < MAX_CLOTHES) {
        // Use pointers to avoid modifying the line buffer with strtok
        char *name = strtok(line, ",");
        char *category = strtok(NULL, ",");
        char *is_missing_str = strtok(NULL, ",");
        char *in_laundry_str = strtok(NULL, ",");
        char *lost_date = strtok(NULL, ",");
        char *image = strtok(NULL, ",");
        char *last_washed = strtok(NULL, ",\n");

        if (name && category && is_missing_str && in_laundry_str && lost_date && image && last_washed) {
            strncpy(closet[closet_count].name, name, MAX_NAME - 1);
            closet[closet_count].name[MAX_NAME - 1] = '\0';
            strncpy(closet[closet_count].category, category, MAX_CATEGORY - 1);
            closet[closet_count].category[MAX_CATEGORY - 1] = '\0';
            closet[closet_count].is_missing = atoi(is_missing_str);
            closet[closet_count].in_laundry = atoi(in_laundry_str);
            strncpy(closet[closet_count].lost_date, lost_date, 15);
            closet[closet_count].lost_date[15] = '\0';
            strncpy(closet[closet_count].image, image, MAX_IMAGE - 1);
            closet[closet_count].image[MAX_IMAGE - 1] = '\0';
            strncpy(closet[closet_count].last_washed, last_washed, MAX_LAST_WASHED - 1);
            closet[closet_count].last_washed[MAX_LAST_WASHED - 1] = '\0';
            closet_count++;
        }
    }
    fclose(f);
}

// Save closet to file for a user
void save_closet_to_file(const char *username) {
    char filename[128];
    get_closet_filename(username, filename, sizeof(filename));
    FILE *f = fopen(filename, "w");
    if (!f) {
        perror("Failed to open closet file for writing");
        return;
    }
    for (int i = 0; i < closet_count; i++) {
        fprintf(f, "%s,%s,%d,%d,%s,%s,%s\n",
            closet[i].name,
            closet[i].category,
            closet[i].is_missing,
            closet[i].in_laundry,
            closet[i].lost_date,
            closet[i].image,
            closet[i].last_washed
        );
    }
    fclose(f);
}

// Find cloth index by name and category
int find_cloth(const char *name, const char *category) {
    for (int i = 0; i < closet_count; i++) {
        if (strcmp(closet[i].name, name) == 0 && strcmp(closet[i].category, category) == 0) {
            return i;
        }
    }
    return -1;
}

// Print closet as CSV for Flask
void print_closet_csv() {
    for (int i = 0; i < closet_count; i++) {
        printf("%s,%s,%d,%d,%s,%s,%s\n",
            closet[i].name,
            closet[i].category,
            closet[i].is_missing,
            closet[i].in_laundry,
            closet[i].lost_date,
            closet[i].image,
            closet[i].last_washed
        );
    }
}

// Print available clothes for laundry (not missing, not in laundry)
void print_available_for_laundry_csv() {
    for (int i = 0; i < closet_count; i++) {
        if (!closet[i].is_missing && !closet[i].in_laundry) {
            printf("%s,%s,%d,%d,%s,%s,%s\n",
                closet[i].name,
                closet[i].category,
                closet[i].is_missing,
                closet[i].in_laundry,
                closet[i].lost_date,
                closet[i].image,
                closet[i].last_washed
            );
        }
    }
}

// Print categories for dropdown
void print_categories_csv() {
    for (int i = 0; i < NUM_CATEGORIES; i++) {
        printf("%s\n", categories[i]);
    }
}

// Add cloth (with validation)
int add_cloth_cmd(const char *name, const char *category, const char *image) {
    if (!name || !category || strlen(name) == 0 || strlen(category) == 0) {
        printf("invalid input\n");
        return 2;
    }
    if (find_cloth(name, category) != -1) {
        printf("already exists\n");
        return 1;
    }
    if (closet_count >= MAX_CLOTHES) {
        printf("closet full\n");
        return 3;
    }
    strncpy(closet[closet_count].name, name, MAX_NAME - 1);
    closet[closet_count].name[MAX_NAME - 1] = '\0';
    strncpy(closet[closet_count].category, category, MAX_CATEGORY - 1);
    closet[closet_count].category[MAX_CATEGORY - 1] = '\0';
    closet[closet_count].is_missing = 0;
    closet[closet_count].in_laundry = 0;
    strcpy(closet[closet_count].lost_date, STATUS_NONE);
    strncpy(closet[closet_count].image, image, MAX_IMAGE - 1);
    closet[closet_count].image[MAX_IMAGE - 1] = '\0';
    strcpy(closet[closet_count].last_washed, STATUS_NEVER);
    closet_count++;
    printf("OK\n");
    return 0;
}

// Delete cloth
void delete_cloth_cmd(const char *name, const char *category) {
    int idx = find_cloth(name, category);
    if (idx == -1) {
        printf("not found\n");
        return;
    }
    for (int i = idx; i < closet_count - 1; i++) closet[i] = closet[i + 1];
    closet_count--;
    printf("OK\n");
}

// Mark as missing
void mark_missing_cmd(const char *name, const char *category) {
    int idx = find_cloth(name, category);
    if (idx == -1) {
        printf("not found\n");
        return;
    }
    closet[idx].is_missing = 1;
    get_today(closet[idx].lost_date, sizeof(closet[idx].lost_date));
    printf("OK\n");
}

// Mark as received (found)
void mark_received_cmd(const char *name, const char *category) {
    int idx = find_cloth(name, category);
    if (idx == -1) {
        printf("not found\n");
        return;
    }
    closet[idx].is_missing = 0;
    strcpy(closet[idx].lost_date, STATUS_NONE);
    printf("OK\n");
}

// Trim history file if it's too long, then add the new record.
void trim_and_add_history(const char *username, const char *name, const char *category) {
    char history_filename[128];
    get_laundry_history_filename(username, history_filename, sizeof(history_filename));

    char lines[MAX_HISTORY_LINES][256];
    int line_count = 0;

    // 1. Read existing lines into memory
    FILE *f_read = fopen(history_filename, "r");
    if (f_read) {
        while (line_count < MAX_HISTORY_LINES && fgets(lines[line_count], sizeof(lines[0]), f_read)) {
            lines[line_count][strcspn(lines[line_count], "\n")] = 0; // Remove newline
            line_count++;
        }
        fclose(f_read);
    }

    // 2. Re-open the file in write mode to clear it
    FILE *f_write = fopen(history_filename, "w");
    if (!f_write) {
        perror("history file write error");
        return;
    }

    // 3. Write back the old lines, skipping the first if we've hit the max
    int start_index = (line_count >= MAX_HISTORY_LINES) ? 1 : 0;
    for (int i = start_index; i < line_count; i++) {
        fprintf(f_write, "%s\n", lines[i]);
    }

    // 4. Add the new record
    char today[16];
    get_today(today, sizeof(today));
    fprintf(f_write, "%s;%s;%s;%s\n", today, name, category, STATUS_PENDING);

    fclose(f_write);
}

// Send laundry (set in_laundry=1 and record history)
void send_laundry_cmd(const char *username, const char *name, const char *category) {
    int idx = find_cloth(name, category);
    if (idx == -1 || closet[idx].is_missing) {
        printf("not available\n");
        return;
    }
    closet[idx].in_laundry = 1;

    // Record in history file, trimming if necessary
    trim_and_add_history(username, name, category);

    printf("OK\n");
}

// Mark laundry as returned (set in_laundry=0 and update last_washed)
void return_laundry_cmd(const char *username, const char *name, const char *category) {
    int idx = find_cloth(name, category);
    if (idx == -1) {
        printf("not found\n");
        return;
    }
    closet[idx].in_laundry = 0;
    get_today(closet[idx].last_washed, sizeof(closet[idx].last_washed));

    // Update the history file by finding the most recent "Pending" entry for this item
    char history_filename[128];
    get_laundry_history_filename(username, history_filename, sizeof(history_filename));
    
    FILE *f_history = fopen(history_filename, "r");
    if (!f_history) {
        printf("history file not found for update\n");
        return; // Nothing to update
    }

    // Read all lines into memory to process in reverse
    char lines[MAX_HISTORY_LINES][256];
    int line_count = 0;
    while (line_count < MAX_HISTORY_LINES && fgets(lines[line_count], sizeof(lines[0]), f_history)) {
        lines[line_count][strcspn(lines[line_count], "\n")] = 0;
        line_count++;
    }
    fclose(f_history);

    int updated = 0;
    // Search backwards for the most recent pending entry
    for (int i = line_count - 1; i >= 0; i--) {
        char temp_line[256];
        strcpy(temp_line, lines[i]);

        char *send_date = strtok(temp_line, ";");
        char *item_name = strtok(NULL, ";");
        char *item_cat = strtok(NULL, ";");
        char *status = strtok(NULL, "\n");

        if (item_name && item_cat && status &&
            strcmp(item_name, name) == 0 &&
            strcmp(item_cat, category) == 0 &&
            strcmp(status, STATUS_PENDING) == 0)
        {
            char today[16];
            get_today(today, sizeof(today));
            // Reconstruct the original line with the new status
            snprintf(lines[i], sizeof(lines[0]), "%s;%s;%s;%s", send_date, item_name, item_cat, today);
            updated = 1;
            break; // Found and updated the most recent one, so we stop.
        }
    }

    // If an update happened, rewrite the entire history file
    if (updated) {
        FILE *f_write = fopen(history_filename, "w");
        if (!f_write) {
            perror("Failed to open history file for writing");
            return;
        }
        for (int i = 0; i < line_count; i++) {
            fprintf(f_write, "%s\n", lines[i]);
        }
        fclose(f_write);
    }

    printf("OK\n");
}

// Read and print the entire laundry history file
void laundry_history_cmd(const char *username) {
    char history_filename[128];
    get_laundry_history_filename(username, history_filename, sizeof(history_filename));
    FILE *f = fopen(history_filename, "r");
    if (!f) {
        return; // No history file, print nothing.
    }
    char line[256];
    while (fgets(line, sizeof(line), f)) {
        printf("%s", line); // Print each line, which includes a newline
    }
    fclose(f);
}

int main(int argc, char *argv[]) {
    if (argc < 3) {
        printf("Usage: %s <username> <command> [args...]\n", argv[0]);
        return 1;
    }
    const char *username = argv[1];
    const char *command = argv[2];
    load_closet_from_file(username);

    if (strcmp(command, "list_clothes") == 0) {
        print_closet_csv();
    } else if (strcmp(command, "list_available_for_laundry") == 0) {
        print_available_for_laundry_csv();
    } else if (strcmp(command, "list_categories") == 0) {
        print_categories_csv();
    } else if (strcmp(command, "laundry_history") == 0) {
        laundry_history_cmd(username);
    } else if (strcmp(command, "add_cloth") == 0 && argc == 6) {
        if (add_cloth_cmd(argv[3], argv[4], argv[5]) == 0) {
            save_closet_to_file(username);
        }
    } else if (strcmp(command, "delete_cloth") == 0 && argc == 5) {
        delete_cloth_cmd(argv[3], argv[4]);
        save_closet_to_file(username);
    } else if (strcmp(command, "mark_missing") == 0 && argc == 5) {
        mark_missing_cmd(argv[3], argv[4]);
        save_closet_to_file(username);
    } else if (strcmp(command, "mark_received") == 0 && argc == 5) {
        mark_received_cmd(argv[3], argv[4]);
        save_closet_to_file(username);
    } else if (strcmp(command, "send_laundry") == 0 && argc == 5) {
        send_laundry_cmd(username, argv[3], argv[4]);
        save_closet_to_file(username);
    } else if (strcmp(command, "return_laundry") == 0 && argc == 5) {
        return_laundry_cmd(username, argv[3], argv[4]);
        save_closet_to_file(username);
    } else {
        printf("Unknown command or wrong arguments.\n");
        return 1;
    }

    return 0;
}