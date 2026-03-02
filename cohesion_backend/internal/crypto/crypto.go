package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"log"
	"os"
	"sync"
)

func deriveKey(secret string) []byte {
	h := sha256.Sum256([]byte(secret))
	return h[:]
}

var warnOnce sync.Once

func getSecret() string {
	s := os.Getenv("ENCRYPTION_KEY")
	if s == "" {
		warnOnce.Do(func() {
			log.Println("WARNING: ENCRYPTION_KEY not set — secrets will be stored in plaintext")
		})
	}
	return s
}

func Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	secret := getSecret()
	if secret == "" {
		return plaintext, nil
	}

	block, err := aes.NewCipher(deriveKey(secret))
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return "enc:" + base64.StdEncoding.EncodeToString(ciphertext), nil
}

func Decrypt(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}
	if len(ciphertext) < 4 || ciphertext[:4] != "enc:" {
		return ciphertext, nil
	}

	secret := getSecret()
	if secret == "" {
		return "", errors.New("ENCRYPTION_KEY not set, cannot decrypt")
	}

	data, err := base64.StdEncoding.DecodeString(ciphertext[4:])
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(deriveKey(secret))
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertextBytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}
