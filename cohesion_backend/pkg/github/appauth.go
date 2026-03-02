package github

import (
	"net/http"

	"github.com/bradleyfalzon/ghinstallation/v2"
	gh "github.com/google/go-github/v68/github"
)

type AppAuth struct {
	appID      int64
	privateKey []byte
}

func NewAppAuth(appID int64, privateKey []byte) *AppAuth {
	if appID == 0 || len(privateKey) == 0 {
		return nil
	}
	return &AppAuth{appID: appID, privateKey: privateKey}
}

func (a *AppAuth) IsConfigured() bool {
	return a != nil
}

func (a *AppAuth) InstallationClient(installationID int64) (*gh.Client, error) {
	transport, err := ghinstallation.New(http.DefaultTransport, a.appID, installationID, a.privateKey)
	if err != nil {
		return nil, err
	}
	return gh.NewClient(&http.Client{Transport: transport}), nil
}

func (a *AppAuth) AppClient() (*gh.Client, error) {
	transport, err := ghinstallation.NewAppsTransport(http.DefaultTransport, a.appID, a.privateKey)
	if err != nil {
		return nil, err
	}
	return gh.NewClient(&http.Client{Transport: transport}), nil
}
