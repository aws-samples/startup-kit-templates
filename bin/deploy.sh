#!/bin/bash

#
# Usage: ./bin/deploy.sh awslabs-startup-kit-templates-deploy-v3 startup
#
# The first argument is the bucket and the second is the aws cli profile
#

set -o errexit -o xtrace

BUCKET=$1

PROFILE=$2

aws s3api head-bucket --profile $PROFILE --bucket $BUCKET || aws s3 mb --profile $PROFILE s3://$BUCKET

aws s3api put-bucket-policy --profile $PROFILE --bucket $BUCKET \
    --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":\"*\",\"Action\":[\"s3:GetObject\",\"s3:GetObjectVersion\"],\"Resource\":\"arn:aws:s3:::$BUCKET/*\"},{\"Effect\":\"Allow\",\"Principal\":\"*\",\"Action\":[\"s3:ListBucket\",\"s3:GetBucketVersioning\"],\"Resource\":\"arn:aws:s3:::$BUCKET\"}]}" \

aws s3api put-bucket-versioning --profile $PROFILE --bucket $BUCKET --versioning-configuration Status=Enabled

find . -name "*.yml" -maxdepth 1 -exec aws s3 cp --profile $PROFILE {} s3://$BUCKET \;

aws s3 cp --profile $PROFILE --recursive templates/ s3://$BUCKET/templates
