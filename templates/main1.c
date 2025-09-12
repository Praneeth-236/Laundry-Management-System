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
    snprintf(buf, sz, "%04d-%02d-%02d", tm.tm_year+1900, tm.tm_mon+1, tm.tm_mday);
}

// Build closet filename for a user
void get_closet_filename(const char *username, char *filename, size_t size) {
    snprintf(filename, size, "closet_%s.txt", username);
}

// Load closet from file for a user
void load_closet_from_file(const char *username) {
    char filename[128];
    get_closet_filename(username, filename, sizeof(filename));
    FILE *f = fopen(filename, "r");
    if (!f) return;
    closet_count = 0;
    char line[512];
    while (fgets(line, sizeof(line), f)) {
        char *name = strtok(line, ",");
        char *category = strtok(NULL, ",");
        char *is_missing = strtok(NULL, ",");
        char *in_laundry = strtok(NULL, ",");
        char *lost_date = strtok(NULL, ",");
        char *image = strtok(NULL, ",");
        char *last_washed = strtok(NULL, ",\n");
        if (name && category && is_missing && in_laundry && lost_date && image && last_washed) {
            strncpy(closet[closet_count].name, name, MAX_NAME-1);
            closet[closet_count].name[MAX_NAME-1] = '\0';
            strncpy(closet[closet_count].category, category, MAX_CATEGORY-1);
            closet[closet_count].category[MAX_CATEGORY-1] = '\0';
            closet[closet_count].is_missing = atoi(is_missing);
            closet[closet_count].in_laundry = atoi(in_laundry);
            strncpy(closet[closet_count].lost_date, lost_date, 15);
            closet[closet_count].lost_date[15] = '\0';
            strncpy(closet[closet_count].image, image, MAX_IMAGE-1);
            closet[closet_count].image[MAX_IMAGE-1] = '\0';
            strncpy(closet[closet_count].last_washed, last_washed, MAX_LAST_WASHED-1);
            closet[closet_count].last_washed[MAX_LAST_WASHED-1] = '\0';
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
    if (!f) return;
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
    strncpy(closet[closet_count].name, name, MAX_NAME-1);
    closet[closet_count].name[MAX_NAME-1] = '\0';
    strncpy(closet[closet_count].category, category, MAX_CATEGORY-1);
    closet[closet_count].category[MAX_CATEGORY-1] = '\0';
    closet[closet_count].is_missing = 0;
    closet[closet_count].in_laundry = 0;
    strcpy(closet[closet_count].lost_date, "None");
    strncpy(closet[closet_count].image, image, MAX_IMAGE-1);
    closet[closet_count].image[MAX_IMAGE-1] = '\0';
    strcpy(closet[closet_count].last_washed, "Never");
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
    for (int i = idx; i < closet_count-1; i++) closet[i] = closet[i+1];
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

// Mark as received
void mark_received_cmd(const char *name, const char *category) {
    int idx = find_cloth(name, category);
    if (idx == -1) {
        printf("not found\n");
        return;
    }
    closet[idx].is_missing = 0;
    strcpy(closet[idx].lost_date, "None");
    printf("OK\n");
}

// Send laundry (set in_laundry=1)
void send_laundry_cmd(const char *name, const char *category) {
    int idx = find_cloth(name, category);
    if (idx == -1 || closet[idx].is_missing) {
        printf("not available\n");
        return;
    }
    closet[idx].in_laundry = 1;
    printf("OK\n");
}

// Mark laundry as returned (set in_laundry=0 and update last_washed)
void return_laundry_cmd(const char *name, const char *category) {
    int idx = find_cloth(name, category);
    if (idx == -1) {
        printf("not found\n");
        return;
    }
    closet[idx].in_laundry = 0;
    get_today(closet[idx].last_washed, sizeof(closet[idx].last_washed));
    printf("OK\n");
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
        return 0;
    }
    if (strcmp(command, "list_available_for_laundry") == 0) {
        print_available_for_laundry_csv();
        return 0;
    }
    if (strcmp(command, "list_categories") == 0) {
        print_categories_csv();
        return 0;
    }
    if (strcmp(command, "add_cloth") == 0 && argc == 6) {
        int res = add_cloth_cmd(argv[3], argv[4], argv[5]);
        if (res == 0) save_closet_to_file(username);
        return 0;
    }
    if (strcmp(command, "delete_cloth") == 0 && argc == 5) {
        delete_cloth_cmd(argv[3], argv[4]);
        save_closet_to_file(username);
        return 0;
    }
    if (strcmp(command, "mark_missing") == 0 && argc == 5) {
        mark_missing_cmd(argv[3], argv[4]);
        save_closet_to_file(username);
        return 0;
    }
    if (strcmp(command, "mark_received") == 0 && argc == 5) {
        mark_received_cmd(argv[3], argv[4]);
        save_closet_to_file(username);
        return 0;
    }
    if (strcmp(command, "send_laundry") == 0 && argc == 5) {
        send_laundry_cmd(argv[3], argv[4]);
        save_closet_to_file(username);
        return 0;
    }
    if (strcmp(command, "return_laundry") == 0 && argc == 5) {
        return_laundry_cmd(argv[3], argv[4]);
        save_closet_to_file(username);
        return 0;
    }

    printf("Unknown command or wrong arguments.\n");
    return 1;
}