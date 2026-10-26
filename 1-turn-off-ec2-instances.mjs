import { EC2Client, StopInstancesCommand, DescribeInstancesCommand } from "@aws-sdk/client-ec2";

// Khởi tạo EC2 Client (thay đổi region phù hợp với hạ tầng của bạn)
const ec2Client = new EC2Client({ region: "ap-southeast-1" }); 

exports.handler = async (event) => {
    try {
        // 1. Tìm các instance đang chạy có tag env=dev
        const describeParams = {
            Filters: [
                {
                    Name: "tag:env",
                    Values: ["dev", "development"] // Hỗ trợ cả 'dev' hoặc 'development'
                },
                {
                    Name: "instance-state-name",
                    Values: ["running"]
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
            console.log("Không tìm thấy instance nào đang chạy với tag env=dev.");
            return { statusCode: 200, body: "No instances to stop." };
        }

        // 2. Thực hiện dừng (Stop) các instance đã tìm thấy
        console.log(`Đang dừng các instance: ${instanceIds.join(", ")}`);
        const stopParams = { InstanceIds: instanceIds };
        await ec2Client.send(new StopInstancesCommand(stopParams));

        return {
            statusCode: 200,
            body: `Đã dừng thành công ${instanceIds.length} instance(s).`
        };

    } catch (err) {
        console.error("Lỗi thực thi:", err);
        throw err;
    }
};
