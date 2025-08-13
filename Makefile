GCR_REPO := il-registry


ifeq ($(APP_NAME),)
    IMAGE_NAME_PLAYWRIGHT  := il-playwright-mcp
endif

ifeq ($(COMMIT),)
	# get the latest commit hash in the short form
	COMMIT := $(shell git rev-parse --short HEAD)
endif

ifeq ($(DATE),)
	# get the latest commit date in the form of YYYYmmdd
    DATE := $(shell git log -1 --format=%cd --date=format:"%Y%m%d")
endif

ifeq ($(TAG_NAME),)
	TAG_NAME := $(COMMIT)-$(DATE)
endif


get-playwright-image-name:
	@echo '$(GCR_REPO)/$(IMAGE_NAME_PLAYWRIGHT)'

get-image-tag:
	@echo '$(TAG_NAME)'