package main

import (
	"embed"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
)

//go:embed static/*
var staticFiles embed.FS

// getStaticHandler returns an http.Handler for serving static files
// It first checks for external static directory, then falls back to embedded files
func getStaticHandler() http.Handler {
	// Check for external static directory (for development)
	externalPath := os.Getenv("BINSH_STATIC_DIR")
	if externalPath == "" {
		// Check common locations
		execPath, _ := os.Executable()
		execDir := filepath.Dir(execPath)
		
		possiblePaths := []string{
			filepath.Join(execDir, "static"),
			filepath.Join(execDir, "..", "share", "binsh", "static"),
			"/usr/share/binsh/static",
			"/usr/local/share/binsh/static",
		}
		
		for _, p := range possiblePaths {
			if info, err := os.Stat(p); err == nil && info.IsDir() {
				externalPath = p
				break
			}
		}
	}
	
	if externalPath != "" {
		if info, err := os.Stat(externalPath); err == nil && info.IsDir() {
			return http.FileServer(http.Dir(externalPath))
		}
	}
	
	// Use embedded files
	subFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		// Fallback to empty handler
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "Static files not available", http.StatusNotFound)
		})
	}
	
	return http.FileServer(http.FS(subFS))
}

// spaHandler serves the SPA (Single Page Application)
// It serves static files and falls back to index.html for client-side routing
func spaHandler() http.HandlerFunc {
	staticHandler := getStaticHandler()
	
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		
		// Serve static assets directly
		if path != "/" && (filepath.Ext(path) != "" || path == "/favicon.ico") {
			staticHandler.ServeHTTP(w, r)
			return
		}
		
		// For all other routes, serve index.html (SPA routing)
		r.URL.Path = "/"
		staticHandler.ServeHTTP(w, r)
	}
}
