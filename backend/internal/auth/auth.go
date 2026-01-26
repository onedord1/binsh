package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
	"golang.org/x/crypto/bcrypt"
)

var (
	client          *mongo.Client
	db              *mongo.Database
	usersCol        *mongo.Collection
	useFileStorage  bool
	fileStoragePath string
	fileMu          sync.RWMutex
	jwtSecret       = []byte("systask-jwt-secret-key-2024")
	ErrUserExists   = errors.New("user already exists")
	ErrInvalidCreds = errors.New("invalid credentials")
	ErrUserNotFound = errors.New("user not found")
)

// User represents a registered user
type User struct {
	ID        bson.ObjectID `bson:"_id,omitempty" json:"-"`
	IDStr     string        `bson:"-" json:"id"`
	Email     string        `bson:"email" json:"email"`
	Password  string        `bson:"password" json:"-"`
	Name      string        `bson:"name" json:"name"`
	CreatedAt time.Time     `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time     `bson:"updated_at" json:"updated_at"`
}

// MarshalJSON ensures ID is always serialized as "id" string
func (u User) MarshalJSON() ([]byte, error) {
	type Alias User
	id := u.IDStr
	if id == "" && !u.ID.IsZero() {
		id = u.ID.Hex()
	}
	return json.Marshal(&struct {
		ID string `json:"id"`
		Alias
	}{
		ID:    id,
		Alias: Alias(u),
	})
}

// FileUser for JSON file storage
type FileUser struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Password  string    `json:"password"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// SetupFileStorage configures file-based auth storage
func SetupFileStorage(dataDir string) error {
	fileStoragePath = filepath.Join(dataDir, "users.json")
	useFileStorage = true
	
	// Ensure directory exists
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return err
	}
	
	// Create file if it doesn't exist
	if _, err := os.Stat(fileStoragePath); os.IsNotExist(err) {
		return saveUsers([]FileUser{})
	}
	return nil
}

func generateID() string {
	bytes := make([]byte, 12)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func loadUsers() ([]FileUser, error) {
	fileMu.RLock()
	defer fileMu.RUnlock()
	
	data, err := os.ReadFile(fileStoragePath)
	if err != nil {
		if os.IsNotExist(err) {
			return []FileUser{}, nil
		}
		return nil, err
	}
	
	var users []FileUser
	if len(data) == 0 {
		return []FileUser{}, nil
	}
	if err := json.Unmarshal(data, &users); err != nil {
		return nil, err
	}
	return users, nil
}

func saveUsers(users []FileUser) error {
	fileMu.Lock()
	defer fileMu.Unlock()
	
	data, err := json.MarshalIndent(users, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(fileStoragePath, data, 0644)
}

// RegisterRequest for user registration
type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

// LoginRequest for user login
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// AuthResponse returned after successful auth
type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// Claims for JWT
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// ConnectMongoDB initializes the MongoDB connection
func ConnectMongoDB(uri string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	serverAPI := options.ServerAPI(options.ServerAPIVersion1)
	opts := options.Client().ApplyURI(uri).SetServerAPIOptions(serverAPI)

	var err error
	client, err = mongo.Connect(opts)
	if err != nil {
		return err
	}

	// Ping to confirm connection
	if err = client.Ping(ctx, readpref.Primary()); err != nil {
		return err
	}

	db = client.Database("systask")
	usersCol = db.Collection("users")

	// Create unique index on email
	indexModel := mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	}
	_, err = usersCol.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		// Ignore error if index already exists
	}

	return nil
}

// DisconnectMongoDB closes the MongoDB connection
func DisconnectMongoDB() error {
	if client != nil {
		return client.Disconnect(context.Background())
	}
	return nil
}

// Register creates a new user
func Register(req RegisterRequest) (*AuthResponse, error) {
	// Use file storage if MongoDB is not available
	if useFileStorage {
		return registerWithFile(req)
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if user exists
	var existingUser User
	err := usersCol.FindOne(ctx, bson.M{"email": req.Email}).Decode(&existingUser)
	if err == nil {
		return nil, ErrUserExists
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create user
	user := User{
		Email:     req.Email,
		Password:  string(hashedPassword),
		Name:      req.Name,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	result, err := usersCol.InsertOne(ctx, user)
	if err != nil {
		return nil, err
	}

	user.ID = result.InsertedID.(bson.ObjectID)

	// Generate JWT
	token, err := generateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

func registerWithFile(req RegisterRequest) (*AuthResponse, error) {
	users, err := loadUsers()
	if err != nil {
		return nil, err
	}
	
	// Check if user exists
	for _, u := range users {
		if u.Email == req.Email {
			return nil, ErrUserExists
		}
	}
	
	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	
	// Create user
	newUser := FileUser{
		ID:        generateID(),
		Email:     req.Email,
		Password:  string(hashedPassword),
		Name:      req.Name,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	
	users = append(users, newUser)
	if err := saveUsers(users); err != nil {
		return nil, err
	}
	
	// Convert to User for response
	user := User{
		IDStr:     newUser.ID,
		Email:     newUser.Email,
		Name:      newUser.Name,
		CreatedAt: newUser.CreatedAt,
		UpdatedAt: newUser.UpdatedAt,
	}
	
	// Generate JWT
	token, err := generateTokenForFileUser(newUser)
	if err != nil {
		return nil, err
	}
	
	return &AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

// Login authenticates a user
func Login(req LoginRequest) (*AuthResponse, error) {
	// Use file storage if MongoDB is not available
	if useFileStorage {
		return loginWithFile(req)
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user User
	err := usersCol.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCreds
	}

	// Generate JWT
	token, err := generateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

func loginWithFile(req LoginRequest) (*AuthResponse, error) {
	users, err := loadUsers()
	if err != nil {
		return nil, err
	}
	
	// Find user by email
	var foundUser *FileUser
	for _, u := range users {
		if u.Email == req.Email {
			foundUser = &u
			break
		}
	}
	
	if foundUser == nil {
		return nil, ErrUserNotFound
	}
	
	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(foundUser.Password), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCreds
	}
	
	// Convert to User for response
	user := User{
		IDStr:     foundUser.ID,
		Email:     foundUser.Email,
		Name:      foundUser.Name,
		CreatedAt: foundUser.CreatedAt,
		UpdatedAt: foundUser.UpdatedAt,
	}
	
	// Generate JWT
	token, err := generateTokenForFileUser(*foundUser)
	if err != nil {
		return nil, err
	}
	
	return &AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

// ValidateToken checks if a JWT is valid
func ValidateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

// GetUserByID retrieves a user by ID
func GetUserByID(id string) (*User, error) {
	// Use file storage if MongoDB is not available
	if useFileStorage {
		return getUserByIDFromFile(id)
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	var user User
	err = usersCol.FindOne(ctx, bson.M{"_id": objID}).Decode(&user)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

func getUserByIDFromFile(id string) (*User, error) {
	users, err := loadUsers()
	if err != nil {
		return nil, err
	}
	
	for _, u := range users {
		if u.ID == id {
			return &User{
				IDStr:     u.ID,
				Email:     u.Email,
				Name:      u.Name,
				CreatedAt: u.CreatedAt,
				UpdatedAt: u.UpdatedAt,
			}, nil
		}
	}
	
	return nil, ErrUserNotFound
}

// generateToken creates a JWT for a user
func generateToken(user User) (string, error) {
	expirationTime := time.Now().Add(7 * 24 * time.Hour) // 7 days

	userID := user.ID.Hex()
	if user.IDStr != "" {
		userID = user.IDStr
	}

	claims := &Claims{
		UserID: userID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "binsh",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// generateTokenForFileUser creates a JWT for a file-based user
func generateTokenForFileUser(user FileUser) (string, error) {
	expirationTime := time.Now().Add(7 * 24 * time.Hour) // 7 days

	claims := &Claims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "binsh",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}
