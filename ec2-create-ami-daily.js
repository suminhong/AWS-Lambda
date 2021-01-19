// Init AWS
var aws = require('aws-sdk');
var ec2 = new aws.EC2();
// OPTION - limit by region
// aws.config.region = 'eu-west-1';

// Variables for the script
// Changes below are not required but if you do change, then change to match delete and create lambda scripts.
const keyForEpochMakerinAMI = "DATETODEL-";
const keyForInstanceTagToBackup = "Backup"; // looks for string yes
const keyForInstanceTagDurationBackup = "BackupRetentionDays"; // accepts numbers like 5 or 10 or 22 and so on.
const keyForInstanceTagNoReboot = "BackupNoReboot"; // if true then it wont reboot. If not present or set to false then it will reboot.
const keyForInstanceTagExecluded = "BackupExcluded";
const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

// Lambda handler
exports.handler = function (event, context) {

    var instanceparams = {
        Filters: [
            {
                Name: 'tag:' + keyForInstanceTagToBackup,
                Values: [
                    'logisd'
                ]
            },
            //Valus에 원하는 필터값 넣으면 됨
            /*
            // OPTION - Add additional filters
            {
                Name: 'tag:someOtherTagName',
                Values: [
                    'someValue'
                ]
            }
            */
        ]
    };

    ec2.describeInstances(instanceparams, function (err, data) {
        if (err) console.log(err, err.stack);
        else {
            for (var i in data.Reservations) {
                for (var j in data.Reservations[i].Instances) {
                    var instanceid = data.Reservations[i].Instances[j].InstanceId;
                    var name = "", backupRetentionDaysforAMI = -1, backupRunTodayCheck = "", noReboot = false;
                    var execludedList = [];
                    for (var k in data.Reservations[i].Instances[j].Tags) {
                        if (data.Reservations[i].Instances[j].Tags[k].Key == 'Name') {
                            name = data.Reservations[i].Instances[j].Tags[k].Value;
                        }
                        if (data.Reservations[i].Instances[j].Tags[k].Key == keyForInstanceTagDurationBackup) {
                            backupRetentionDaysforAMI = parseInt(data.Reservations[i].Instances[j].Tags[k].Value);
                        }
                        if (data.Reservations[i].Instances[j].Tags[k].Key == keyForInstanceTagNoReboot) {
                            if (data.Reservations[i].Instances[j].Tags[k].Value == "true") {
                                noReboot = true;
                            }
                        }
                        if (data.Reservations[i].Instances[j].Tags[k].Key == keyForInstanceTagExecluded) {
                            if (data.Reservations[i].Instances[j].Tags[k].Value.length > 0) {
                                console.log(data.Reservations[i].Instances[j].Tags[k].Value);
                                execludedList = data.Reservations[i].Instances[j].Tags[k].Value.split(',');
                            }
                        }
                    }
                    // cant find when to delete then dont proceed.
                    if (backupRetentionDaysforAMI < 1) {
                        console.log("Skipping instance Name: " + name + " backupRetentionDaysforAMI: " + backupRetentionDaysforAMI + " (backupRetentionDaysforAMI > 0)" + (backupRetentionDaysforAMI > 0));
                    } else {
                        console.log("Processing instance Name: " + name + " backupRetentionDaysforAMI: " + backupRetentionDaysforAMI + " (backupRetentionDaysforAMI > 0)" + (backupRetentionDaysforAMI > 0));
                        var genDate = new Date();
                        genDate.setDate(genDate.getDate() + backupRetentionDaysforAMI); // days that are required to be held
                        var imageparams = {
                            InstanceId: instanceid,
                            Name: name + "_" + keyForEpochMakerinAMI + genDate.getTime(),
                        };
                        if (noReboot == true) {
                            imageparams["NoReboot"] = true;
                        }
                        if (execludedList.length > 0) {
                            var blockDeviceList = [];
                            for (var i = 0; i < execludedList.length; i++) {
                                var deviceMap = { DeviceName: execludedList[i], NoDevice: "" };
                                console.log(deviceMap);
                                blockDeviceList.push(deviceMap)
                            }
                            imageparams["BlockDeviceMappings"] = blockDeviceList;
                        }
                        console.log(imageparams);
                        ec2.createImage(imageparams, function (err, data) {
                            if (err) console.log(err, err.stack);
                            else {
                                var image = data.ImageId;
                                console.log(image);
                                var tagparams = {
                                    Resources: [image],
                                    Tags: [{
                                        Key: 'DeleteBackupsAutoOn',
                                        Value: 'yes'
                                    },
                                    {
                                        Key: 'Frequency',
                                        Value: 'd'
                                        //daily, weekly 선택
                                    }]
                                };
                                ec2.createTags(tagparams, function (err, data) {
                                    if (err) console.log(err, err.stack);
                                    else console.log("Tags added to the created AMIs");
                                });
                                sleep(10).then(() => { console.log("delay 10ms") });
                            }
                        });
                    }
                }
            }
        }
    });
}