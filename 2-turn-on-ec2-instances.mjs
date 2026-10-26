import { EC2Client, StartInstancesCommand, DescribeInstancesCommand } from "@aws-sdk/client-ec2";

// Khởi tạo EC2 Client (thay đổi region phù hợp với hạ tầng của bạn)
const ec2Client = new EC2Client({ region: "ap-southeast-1" }); 

exports.handler = async (event) => {
    try {
        // 1. Tìm các instance đang ở trạng thái 'stopped' và có tag env=dev
        const describeParams = {
            Filters: [
                {
                    Name: "tag:env",
                    Values: ["dev"]
                },
                {
                    Name: "instance-state-name",
                    Values: ["stopped"] // Chỉ tìm các máy đang tắt để tránh báo lỗi khi máy đang chạy
                }
            ]
        };

        const data = await ec2Client.send(new DescribeInstancesCommand(describeParams));
        
        // Trích xuất danh sách InstanceId
        const instanceIds = [];
        data.Reservations.forEach(reservation => {
            reservation.Instances.forEach(instance => {
                instanceIds.push(instance.InstanceId);
            });
        });

        if (instanceIds.length === 0) {
            console.log("Không tìm thấy instance nào đang tắt với tag env=dev.");
            return { statusCode: 200, body: "No instances to start." };
        }

        // 2. Thực hiện khởi động (Start) các instance đã tìm thấy
        console.log(`Đang khởi động các instance: ${instanceIds.join(", ")}`);
        const startParams = { InstanceIds: instanceIds };
        await ec2Client.send(new StartInstancesCommand(startParams));

        return {
            statusCode: 200,
            body: `Đã khởi động thành công ${instanceIds.length} instance(s).`
        };

    } catch (err) {
        console.error("Lỗi thực thi:", err);
        throw err;
    }
};
