package main

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	ARTICLES_DIR    = "./articles"
	GITHUB_BASE_URL = "https://github.com/object-t/object-t-blog/blob/main/articles"
)

type ArticleDetails struct {
	Id          string   `json:"id"`
	Title       string   `json:"title"`
	Thumbnail   string   `json:"thumbnail"`
	ArticleType string   `json:"type"`
	Topics      []string `json:"topics"`
	Author      string   `json:"author"`
	CreatedAt   string   `json:"created_at"`
	Published   bool     `json:"published"`
}

func main() {
	entries, err := os.ReadDir(ARTICLES_DIR)
	if err != nil {
		fmt.Println("Error reading directory:", err)
		return
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	var articles []ArticleDetails
	re := regexp.MustCompile(`(?m)^(\w+):`)

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		articlePath := ARTICLES_DIR + "/" + entry.Name()
		contentBytes, err := os.ReadFile(articlePath)
		if err != nil {
			fmt.Printf("Error reading file %s: %v\n", articlePath, err)
			continue
		}

		content := string(contentBytes)
		splited := strings.Split(content, "---\n")
		if !strings.HasPrefix(content, "---\n") || len(splited) <= 2 {
			fmt.Printf("Error can't find article details %s\n", articlePath)
			continue
		}

		fixed := re.ReplaceAllString(splited[1], `"$1":`)
		lines := strings.Split(strings.TrimSpace(fixed), "\n")
		var jsonLines []string
		for _, line := range lines {
			if strings.TrimSpace(line) != "" {
				jsonLines = append(jsonLines, line)
			}
		}
		jsonBody := "{" + strings.Join(jsonLines, ",") + "}"

		var article ArticleDetails
		err = json.Unmarshal([]byte(jsonBody), &article)
		if err != nil {
			fmt.Println("Faild parse details to json:", err)
			return
		}

		if !article.Published {
			continue
		}

		article.Id = entry.Name()
		articles = append(articles, article)
	}

	sort.Slice(articles, func(i, j int) bool {
		layout := "2006/01/02"
		ti, err1 := time.Parse(layout, articles[i].CreatedAt)
		tj, err2 := time.Parse(layout, articles[j].CreatedAt)

		if err1 != nil && err2 != nil {
			return articles[i].Title < articles[j].Title
		}
		if err1 != nil {
			return false
		}
		if err2 != nil {
			return true
		}

		if ti.Equal(tj) {
			return articles[i].Title < articles[j].Title
		}
		return ti.Before(tj)
	})

	outputBytes, err := json.MarshalIndent(articles, "", "  ")
	if err != nil {
		fmt.Println("Error marshaling articles to JSON:", err)
		return
	}

	err = os.WriteFile("articles.json", outputBytes, 0644)
	if err != nil {
		fmt.Println("Error writing articles.json:", err)
		return
	}
}
