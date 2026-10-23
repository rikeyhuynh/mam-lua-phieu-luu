# MẦM LÚA PHIÊU LƯU — WEBSITE V5 (3D ĐỦ MÀU)

## Chạy ngay không cần cài đặt
1. Giải nén **toàn bộ** ZIP vào một thư mục mới (không trộn với website V4).
2. Nhấp đúp `index.html` để mở bằng Chrome hoặc Microsoft Edge.
3. Chọn **Nhân vật** → **3D CHARACTER**. Mầm Mí hiển thị với màu tóc, da, quần áo và phụ kiện lấy từ chính `MamMi.glb` mới.
4. Kéo chuột để xoay, cuộn chuột để phóng to/thu nhỏ; nhấn FRONT/BACK/LEFT/RIGHT để chọn góc.

## Vì sao V4 vẫn là màu kem dù thay GLB?
Viewer WebGL2 cũ chỉ lấy hình học và một màu `baseColorFactor` rồi tô tất cả bằng chất liệu clay. GLB mới có ba mesh/vật liệu (`Hair_low`, `Material.002` và `Bodyhead_low`) kèm 12 ảnh texture PNG (bao gồm base color, normal). Viewer V5 đọc được cả ba mesh, node transforms, UV và texture màu/normal tương ứng. Không cần dùng ảnh WEBP nhân vật để tô màu mô hình.

## Mở trực tiếp `index.html`
- `Assets/MamMi.glb`: file GLB **có màu**, nguyên vẹn như file mới bạn gửi.
- `Assets/MamMi-data.js`: bản nhúng của **chính GLB mới**, dùng cho việc mở `index.html` bằng `file://` không cần máy chủ.
- `viewer3d-local.js`: WebGL2 viewer tích hợp, đọc texture PNG nhúng trong GLB, không dùng CDN cho 3D.
- **Nếu thay model sau này**, ghi đè `Assets/MamMi.glb` và chạy `CAP_NHAT_MODEL.bat` (Windows có Python) để cập nhật `Assets/MamMi-data.js`, trước khi mở bằng file://. Nếu chạy web qua http(s), tệp GLB được tải trực tiếp và không cần bước cập nhật này.

## Các phần khác
Bố cục, font Be Vietnam Pro, logo, nền đường chạy, logic ba làn, nhảy và tự chạy như V4 vẫn được giữ nguyên. Có thể chạy `CHAY-WEBSITE-WINDOWS.bat` nếu muốn chạy dưới localhost (không bắt buộc).

## Giới hạn kỹ thuật
- Mô hình GLB bạn gửi **không chứa animation**, nên viewer cho phép xoay, xem các góc và zoom nhưng không tự chơi animation 3D. Phần thử chuyển động game vẫn dùng chuỗi frame 2D.
- Cần trình duyệt hỗ trợ WebGL2 và bật tăng tốc đồ họa.
- Nếu có thay đổi texture, xuất lại GLB từ Blender với **Images / Materials được nhúng**.
