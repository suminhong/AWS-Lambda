import boto3
# Specify the region where your insatnces are running. For example 'ap-southeast-1'
region = 'ap-northeast-2'	#리전
# Specify the insatnce IDs that you want to start at specific time. For example, ['i-abcd01234567', 'i-efgh01234567']
instances = ['인스턴스ID','인스턴스ID']	#스탑시킬 인스턴스 아이디
def lambda_handler(event, context):
    ec2 = boto3.client('ec2', region_name=region)
    ec2.stop_instances(InstanceIds=instances)
    print ('stop your instances: ' + str(instances))