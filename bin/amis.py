""" Get Bastion AMI for every region
"""

import boto3, botocore, sys, os
from ruamel.yaml import YAML
from botocore.client import Config

def get_regions(client):
    """ Load the region codes
    """
    response = client.describe_regions()
    regions = []
    for region in response['Regions']:
        regions.append(region['RegionName'])
    return regions

def bastion_ami(session, config, region):
	bastion_ami = []
	ami_filters= [
	{'Name':'virtualization-type','Values':['hvm']},
	{'Name':'hypervisor','Values':['xen']},
	{'Name':'owner-alias','Values':['amazon']},
	{'Name':'ena-support','Values':['true']},
	{'Name':'sriov-net-support','Values':['simple']},
	{'Name':'state','Values':['available']},
	{'Name':'architecture','Values':['x86_64']},
	{'Name':'root-device-type','Values':['ebs']},
	{'Name':'root-device-name','Values':['/dev/xvda']},
	{'Name':'image-type','Values':['machine']},
	{'Name':'is-public','Values':['true']},
	{'Name':'block-device-mapping.volume-type','Values':['gp2']},
	{'Name':'block-device-mapping.volume-size','Values':['8']},
	{'Name':'block-device-mapping.delete-on-termination','Values':['true']},
	{'Name':'block-device-mapping.device-name','Values':['/dev/xvda']}]

	ec2_client = session.client('ec2', region_name=region, config= config)
	amis =  ec2_client.describe_images(ExecutableUsers=['all'], Owners=['amazon'], Filters = ami_filters)['Images']
	exclude_names = [ 'elasticbeanstalk', 'ecs', 'amzn2', 'test' ]

	for ami in amis:
		if not any(exclude_name in ami['Name'] for exclude_name in exclude_names):
			bastion_ami.append(ami)

	sort_list = [(dict_['CreationDate'], dict_) for dict_ in bastion_ami]
	sort_list.sort(reverse=True)
	return sort_list[0][1]['ImageId']

def main():

    config = Config(connect_timeout=60, read_timeout=60)
    session = boto3.Session(profile_name=None if len(sys.argv) < 2 else sys.argv[1])
    amis = {}
    f = open("ami.yaml","w")
    for region in get_regions(session.client('ec2', region_name= 'us-east-1', config= config)):
    	amis[region] = {"AMI": bastion_ami(session, config, region)}

    yaml=YAML()
    yaml.default_flow_style = False

    #Print AMI list, in yaml format, to terminal
    yaml.dump(amis, sys.stdout)

    #Dump AMI list in yaml format to a file
    yaml.dump(amis, f)
    
if __name__ == '__main__':
    main()


