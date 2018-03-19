#!/usr/bin/env python

import boto3, botocore, os, time, sys
from os.path import expanduser
from botocore.client import Config

TEST_APP_BUCKET_PREFIX='awslabs-startup-kit-templates-test-eb-v1-tmp-'
TEST_APP_SOURCE_BUCKET='awslabs-startup-kit-templates-test-eb-v1'

TEST_PYTHON_APP_KEY='eb-python-flask.zip'

TEMPLATE_URL_PREFX='https://s3.amazonaws.com/awslabs-startup-kit-templates-deploy-v2/'
EB_TEMPLATE_URL='{}vpc-bastion-eb-rds.cfn.yml'.format(TEMPLATE_URL_PREFX)
VPC_TEMPLATE_URL='{}vpc.cfn.yml'.format(TEMPLATE_URL_PREFX)
VPC_BASTION_TEMPLATE_URL='{}vpc-bastion.cfn.yml'.format(TEMPLATE_URL_PREFX)

KEY_PAIR_PREFIX='sktemplates-test-'

def get_regions(client):
    """ Load the region codes
    """
    response = client.describe_regions()
    regions = []
    for region in response['Regions']:
        regions.append(region['RegionName'])
    return regions

def get_availability_zones(client, region):
    """ Load the first two AZs for a region
    """
    azs = client.describe_availability_zones()['AvailabilityZones']

    if len(azs) < 2:
        print 'Region without two AZs (skipping): {}'.format(region)
        return None

    return [ azs[0]['ZoneName'], azs[1]['ZoneName'] ]

def create_key_pair(client, name):
    """ Create a new key pair and return the private key
    """
    response = client.create_key_pair(KeyName=name)
    return response['KeyMaterial']

def store_key_locally(name, private_key):
    """ Store the key in your ~/.ssh directory
    """
    file_name = '{}/.ssh/{}'.format(expanduser("~"), name)

    file = open(file_name, 'w')
    file.write(private_key)
    file.close()
    os.chmod(file_name, 0400)

def has_key_pair(client, name):
    """ If the EC2 key pair exists, then true is returned
    """
    try:
        client.describe_key_pairs(KeyNames=[ name ])
        return True
    except botocore.exceptions.ClientError as ce:
        if ce.response['Error']['Code'] == 'InvalidKeyPair.NotFound':
            return False
        raise ce

def has_bucket(client, name):
    """ If the S3 bucket exists, then true is returned
    """
    try:
        client.head_bucket(Bucket=name)
        return True
    except botocore.exceptions.ClientError as ce:
        if ce.response['Error']['Code'] == '404':
            return False
        raise ce

def create_bucket(client, name, region):
    """ Create the S3 bucket
    """
    if region == 'us-east-1':
        # S3 in us-east-1 does not accept a location constraint
        client.create_bucket(Bucket=name, ACL='public-read')
    else:
        client.create_bucket(Bucket=name, ACL='public-read', CreateBucketConfiguration={ 'LocationConstraint': region })

def update_sample_app(client, app_bucket_name, source_bucket_name, app_key):
    """ Copy a sample app from the central bucket to the region where the stack is being created
    """
    print 'Update sample app: {}'.format(app_key)
    copy_source = { 'Bucket': source_bucket_name, 'Key': app_key }
    client.copy(copy_source, app_bucket_name, app_key)
    client.put_object_acl(ACL='public-read', Bucket=app_bucket_name, Key=app_key)

def is_stack(client, stack_id, state):
    """ Returns true if the stack is in the passed state
    """
    for stack in client.describe_stacks(StackName=stack_id)['Stacks']:
        if stack['StackStatus'] == state:
            return True
    return False

def has_stack_create_error(client, stack_id):
    """ Returns true if the stack status is anything but CREATE_COMPLETE
    """
    for stack in client.describe_stacks(StackName=stack_id)['Stacks']:
        if stack['StackStatus'] == 'CREATE_COMPLETE':
            return False
    return True

def has_stack_delete_error(client, stack_id):
    """ Returns true if the stack fails to delete
    """
    try:
        for stack in client.describe_stacks(StackName=stack_id)['Stacks']:
            if stack['StackStatus'] != 'DELETE_COMPLETE':
                return True
        return False
    except botocore.exceptions.ClientError as ce:
        if ce.response['Error']['Code'] == 'ValidationError':
            return False
        raise ce

def create_stack(client, stack_name, template_url, parameters):
    response = client.create_stack(
        StackName=stack_name,
        TemplateURL=template_url,
        Capabilities=[ 'CAPABILITY_NAMED_IAM' ],
        Parameters=parameters,
    )
    return response['StackId']

def create_eb_stack(client, stack_name, azs, environment, ssh_key, app_bucket, app_key, stack_type, db_engine, alarms, enhanced_alarms):
    """ Create the elastic beanstalk stack and return the stack id
    """
    parameters = [
        { 'ParameterKey': 'EnvironmentName', 'ParameterValue': environment },
        { 'ParameterKey': 'AvailabilityZone1', 'ParameterValue': azs[0] },
        { 'ParameterKey': 'AvailabilityZone2', 'ParameterValue': azs[1] },
        { 'ParameterKey': 'KeyName', 'ParameterValue': ssh_key },
        { 'ParameterKey': 'StackType', 'ParameterValue': stack_type},
        { 'ParameterKey': 'AppS3Bucket', 'ParameterValue': app_bucket },
        { 'ParameterKey': 'AppS3Key', 'ParameterValue': app_key },
        { 'ParameterKey': 'EC2KeyPairName', 'ParameterValue': ssh_key },
        { 'ParameterKey': 'EbInstanceType', 'ParameterValue': 't2.small' },
        { 'ParameterKey': 'DatabasePassword', 'ParameterValue': 'startupadmin6' },
        { 'ParameterKey': 'DatabaseEngine', 'ParameterValue': db_engine },
    ]

    if alarms:
        parameters.append({ 'ParameterKey': 'DatabaseEnableAlarms', 'ParameterValue': 'true' })
        if enhanced_alarms:
            parameters.append({ 'ParameterKey': 'DatabaseAlarmEvaluationPeriodSeconds', 'ParameterValue': '60' })
            parameters.append({ 'ParameterKey': 'DatabaseEnhancedMonitoring', 'ParameterValue': 'true' })

    return create_stack(client, stack_name, EB_TEMPLATE_URL, parameters)

def create_vpc_stack(client, stack_name, azs, environment):
    """ Create the elastic beanstalk stack and return the stack id
    """
    parameters = [
        { 'ParameterKey': 'EnvironmentName', 'ParameterValue': environment },
        { 'ParameterKey': 'AvailabilityZone1', 'ParameterValue': azs[0] },
        { 'ParameterKey': 'AvailabilityZone2', 'ParameterValue': azs[1] },
    ]
    return create_stack(client, stack_name, VPC_TEMPLATE_URL, parameters)

def create_vpc_bastion_stack(client, stack_name, azs, environment, ssh_key):
    """ Create the elastic beanstalk stack and return the stack id
    """
    parameters = [
        { 'ParameterKey': 'EnvironmentName', 'ParameterValue': environment },
        { 'ParameterKey': 'AvailabilityZone1', 'ParameterValue': azs[0] },
        { 'ParameterKey': 'AvailabilityZone2', 'ParameterValue': azs[1] },
        { 'ParameterKey': 'KeyName', 'ParameterValue': ssh_key },
    ]
    return create_stack(client, stack_name, VPC_BASTION_TEMPLATE_URL, parameters)

def wait_for_stacks(stacks, create):

    action = 'create' if create else 'delete'
    print 'Waiting for stacks to {}'.format(action)

    while True:
        all_done = True
        for stack in stacks:
            for stack_id in stack['stack_ids']:
                if create:
                    if not is_stack(stack['client'], stack_id, 'CREATE_IN_PROGRESS'):
                        if has_stack_create_error(stack['client'], stack_id):
                            print 'Stack failed to create stack id: {} - region: {}'.format(stack_id, stack['region'])
                    else:
                        all_done = False
                else:
                    if not is_stack(stack['client'], stack_id, 'DELETE_IN_PROGRESS'):
                        if has_stack_delete_error(stack['client'], stack_id):
                            print 'Stack failed to delete stack id: {} - region: {}'.format(stack_id, stack['region'])
                    else:
                        all_done = False

        if all_done:
            return
        time.sleep(5)

def ensure_foundation(session, config):
    """ Make sure we have everything we need in place to run the stacks
    """
    for region in get_regions(session.client('ec2', region_name='us-east-1', config=config)):

        print 'Ensure key pair in region: {}'.format(region)

        ec2_client = session.client('ec2', region_name=region, config=config)
        key_name = '{}{}'.format(KEY_PAIR_PREFIX, region)
        if not has_key_pair(ec2_client, key_name):
            store_key_locally(key_name, create_key_pair(ec2_client, key_name))

        s3_client = session.client('s3', region_name=region, config=config)

        print 'Ensure S3 app bucket in region: {}'.format(region)

        app_bucket_name = '{}{}'.format(TEST_APP_BUCKET_PREFIX, region)
        if not has_bucket(s3_client, app_bucket_name):
            create_bucket(s3_client, app_bucket_name, region)

        # Copy the latest version of the file to the bucket
        update_sample_app(s3_client, app_bucket_name, TEST_APP_SOURCE_BUCKET, TEST_PYTHON_APP_KEY)

def test_stack(session, config, stack_type):
    """ Create a specific stack in supported regions, wait for it to create and then delete it
    """
    stacks = []
    for region in get_regions(session.client('ec2', region_name='us-east-1', config=config)):

        azs = get_availability_zones(session.client('ec2', region_name=region, config=config), region)

        # Single AZ regions are not supported e.g., ap-northeast-3
        if azs is None:
            continue

        stack = {}
        stacks.append(stack)
        cfn_client =  session.client('cloudformation', region_name=region, config=config)
        stack['client'] = cfn_client
        stack['region'] = region

        stack_ids = []
        stack['stack_ids'] = stack_ids

        key_name = '{}{}'.format(KEY_PAIR_PREFIX, region)
        app_bucket_name = '{}{}'.format(TEST_APP_BUCKET_PREFIX, region)

        if stack_type == 'vpc':
            print 'Creating vpc stack in: {}'.format(region)
            stack_ids.append(create_vpc_stack(cfn_client, 'test-vpc-0', azs, 'dev'))

        if stack_type == 'vpc-bastion':
            print 'Creating vpc bastion stack in: {}'.format(region)
            stack_ids.append(create_vpc_bastion_stack(cfn_client, 'test-vpc-bastion-0', azs, 'dev', key_name))

        if stack_type == 'vpc-bastion-eb-database':
            print 'Creating eb stack in: {}'.format(region)
            stack_ids.append(create_eb_stack(cfn_client, 'test-eb-0', azs, 'dev', key_name, app_bucket_name, TEST_PYTHON_APP_KEY, 'python', 'mysql', False, False))

        if stack_type == 'vpc-bastion-eb-database-alarm':
            print 'Creating eb stack in: {}'.format(region)
            stack_ids.append(create_eb_stack(cfn_client, 'test-eb-alarm-0', azs, 'dev', key_name, app_bucket_name, TEST_PYTHON_APP_KEY, 'python', 'postgres', True, False))

        if stack_type == 'vpc-bastion-eb-database-enhanced-alarm':
            print 'Creating eb stack with enhanced db monitoring in: {}'.format(region)
            stack_ids.append(create_eb_stack(cfn_client, 'test-eb-enhanced-alarm-0', azs, 'dev', key_name, app_bucket_name, TEST_PYTHON_APP_KEY, 'python', 'mysql', True, True))

    time.sleep(5)

    # Wait for the stacks to create
    wait_for_stacks(stacks, True)

    print 'Deleting stacks'
    for stack in stacks:
        for stack_id in stack['stack_ids']:
            print 'Deleting stack: {} - region: {}'.format(stack_id, stack['region'])
            stack['client'].delete_stack(StackName=stack_id)

    # Wait for the stacks to delete
    wait_for_stacks(stacks, False)

def main():
    """ Create the various stacks in all supported regions
    """
    print 'Testing stacks'

    config = Config(connect_timeout=60, read_timeout=60)
    session = boto3.Session(profile_name=None if len(sys.argv) < 2 else sys.argv[1])
    print 'AWS session created'

    ensure_foundation(session, config)

    tests = [
        'vpc',
        'vpc-bastion',
        'vpc-bastion-eb-database',
        'vpc-bastion-eb-database-alarm',
        'vpc-bastion-eb-database-enhanced-alarm',
    ]

    for test in tests:
        test_stack(session, config, test)

if __name__ == '__main__':
    main()

