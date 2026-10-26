import { EC2Client, DescribeInstancesCommand, ModifyInstanceAttributeCommand } from "@aws-sdk/client-ec2";

const ec2Client = new EC2Client({ region: "ap-southeast-1" }); // Thay đổi region của bạn

exports.handler = async (event) => {
    try {
        // 1. Tìm các instance có tag env=dev
        const describeParams = {
            Filters: [
                { Name: "tag:env", Values: ["dev"] },
                { Name: "instance-state-name", Values: ["stopped"] } // Chỉ đổi được khi máy đã tắt
            ]
        };

        const data = await ec2Client.send(new DescribeInstancesCommand(describeParams));
        const instances = [];
        data.Reservations.forEach(r => r.Instances.forEach(i => instances.push(i)));

        if (instances.length === 0) {
            return { statusCode: 200, body: "Không tìm thấy instance 'stopped' nào có tag env=dev." };
        }

        const results = [];
        for (const instance of instances) {
            // Kiểm tra nếu máy đã là t4g.small thì bỏ qua
            if (instance.InstanceType === "t4g.small") continue;

            console.log(`Đang đổi ${instance.InstanceId} sang t4g.small...`);
            
            const modifyParams = {
                InstanceId: instance.InstanceId,
                InstanceType: { Value: "t4g.small" }
            };

            await ec2Client.send(new ModifyInstanceAttributeCommand(modifyParams));
            results.push(instance.InstanceId);
        }

        return {
            statusCode: 200,
            body: `Đã cập nhật loại máy cho: ${results.join(", ") || "Không có máy nào cần đổi"}`
        };

    } catch (err) {
        console.error("Lỗi:", err);
        throw err;
    }
};
