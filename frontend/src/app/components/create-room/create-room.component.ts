import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { RoomService } from '../../service/room.service';

@Component({
  selector: 'app-create-room',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './create-room.component.html',
  styleUrl: './create-room.component.css'
})
export class CreateRoomComponent implements OnInit {
  userData: any = null;
  nickname: string = '';
  roomName: string = '';
  isPrivate: boolean = false;
  roomPassword: string = '';

  constructor(private roomService: RoomService, private router: Router) {}

  ngOnInit() {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      this.userData = JSON.parse(savedUser);
      this.nickname = this.userData.name || this.userData.given_name;
    }
  }

  handleCreateRoom() {
    if (!this.nickname.trim()) {
      alert('Vui lòng nhập tên gọi của bạn!');
      return;
    }
    
    // Logic tạo phòng thực tế
    const hostName = this.nickname.trim();
    this.roomService.createRoom(hostName, this.roomName, this.isPrivate).subscribe({
      next: (room) => {
        // Có thể lưu thêm tên phòng hoặc mật khẩu vào backend nếu API hỗ trợ
        this.router.navigate(['/room', room.roomId]);
      },
      error: (err) => {
        alert('Lỗi khi tạo phòng. Hãy kiểm tra kết nối Server!');
        console.error(err);
      }
    });
  }

  setPrivacy(isPrivate: boolean) {
    this.isPrivate = isPrivate;
  }
}
