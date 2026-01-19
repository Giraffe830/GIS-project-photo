import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

// --- 1. 引入点聚合相关资源 ---
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { createPathComponent } from '@react-leaflet/core';
import 'leaflet.markercluster';

// --- 2. 点聚合补丁组件 (解决 React-Leaflet v3+ 兼容性) ---
const MarkerClusterGroup = createPathComponent(({ children, ...props }, context) => {
  const markerClusterGroup = new L.MarkerClusterGroup(props);
  return {
    instance: markerClusterGroup,
    context: { ...context, layerContainer: markerClusterGroup },
  };
});

// --- 3. 辅助组件：地图飞行控制 ---
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 13, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

// --- 4. 辅助组件：点击事件监听 ---
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

// 修复 Leaflet 默认图标
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function App() {
  const [photos, setPhotos] = useState([]);
  const [viewCenter, setViewCenter] = useState(null);
  const [searchCircle, setSearchCircle] = useState(null);

  // --- 核心修改：增强版时间格式化函数 ---
  const formatDate = (dateValue) => {
    if (!dateValue) return '未知时间';
    
    // 1. 处理 Exif 常见的冒号格式 (例如 "2023:10:25 12:00:00")
    let dateStr = dateValue;
    if (typeof dateValue === 'string') {
      // 将前两个冒号替换为横杠
      dateStr = dateValue.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    }

    const date = new Date(dateStr);
    
    // 2. 检查是否解析成功
    if (isNaN(date.getTime())) {
      // 如果解析失败，返回原始字符串或错误提示
      return String(dateValue) || '时间格式错误';
    }

    // 3. 返回友好的中文格式
    return date.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // 初始化加载
  useEffect(() => {
    axios.get('http://localhost:5000/photos')
      .then(res => {
        // --- 调试日志：按F12在Console里看这个，确认capture_time是否存在 ---
        console.log("后端返回的第一条数据:", res.data[0]); 

        const sorted = res.data.map(p => ({
          id: p.id, 
          name: p.name, 
          position: [p.lat, p.lng], 
          path: p.path, 
          // 确保这里对应数据库返回的字段名 (通常是 capture_time)
          time: p.capture_time 
        })).sort((a, b) => {
            // 增加排序的容错处理
            const t1 = a.time ? new Date(a.time).getTime() : 0;
            const t2 = b.time ? new Date(b.time).getTime() : 0;
            return t1 - t2;
        });
        setPhotos(sorted);
      })
      .catch(err => console.error("数据加载失败:", err));
  }, []);

  // 上传逻辑
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const res = await axios.post('http://localhost:5000/upload', formData);
      if (res.data.success) {
        const p = res.data.data;
        const newPhoto = { 
            id: p.id, 
            name: p.name, 
            position: [p.lat, p.lng], 
            path: p.path, 
            time: p.capture_time 
        };
        // 重新排序
        setPhotos(prev => [...prev, newPhoto].sort((a, b) => {
            const t1 = a.time ? new Date(a.time).getTime() : 0;
            const t2 = b.time ? new Date(b.time).getTime() : 0;
            return t1 - t2;
        }));
        setViewCenter(newPhoto.position);
      }
    } catch (err) { alert("上传失败"); }
  };

  // 地图点击：空间搜索
  const handleMapClick = async (latlng) => {
    setSearchCircle({ center: [latlng.lat, latlng.lng], radius: 5000 });
    try {
      const res = await axios.get(`http://localhost:5000/photos/search?lng=${latlng.lng}&lat=${latlng.lat}&distance=5000`);
      if (res.data.length > 0) {
        alert(`在该范围内找到了 ${res.data.length} 张照片！`);
      } else {
        alert("该范围内没有照片");
      }
    } catch (err) { console.error(err); }
  };

  const trajectoryPath = photos.map(p => p.position);

  return (
    <div className="app-root">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>📷 旅行足迹系统</h2>
          <div className="stat-text">已记录 {photos.length} 个瞬间</div>
          <div className="upload-btn-wrapper">
            <button className="btn">+ 上传照片</button>
            <input type="file" onChange={handleUpload} accept="image/*" />
          </div>
        </div>
        <div className="photo-list">
          {photos.map(photo => (
            <div key={photo.id} className="photo-item" onClick={() => setViewCenter(photo.position)}>
              <img src={`http://localhost:5000/${photo.path.replace(/\\/g, '/')}`} className="photo-thumb" alt="t" />
              <div className="photo-info">
                <h4>{photo.name}</h4>
                {/* 使用增强后的 formatDate */}
                <p>📅 {formatDate(photo.time)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <MapContainer center={[35, 105]} zoom={4} className="map-container" zoomControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        <MapClickHandler onMapClick={handleMapClick} />
        <MapController center={viewCenter} />

        {searchCircle && (
          <Circle center={searchCircle.center} radius={searchCircle.radius} pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.1 }} />
        )}

        {/* 轨迹线：放在 Marker 下层 */}
        {photos.length > 1 && (
          <>
            <Polyline positions={trajectoryPath} pathOptions={{ color: '#007bff', weight: 3, opacity: 0.3 }} />
            <Polyline positions={trajectoryPath} className="travel-line-animation" pathOptions={{ color: '#007bff', weight: 3 }} />
          </>
        )}

        {/* 点聚合包裹所有的 Marker */}
        <MarkerClusterGroup chunkedLoading showCoverageOnHover={false}>
          {photos.map(photo => (
            <Marker key={photo.id} position={photo.position}>
              <Popup>
                <div style={{ textAlign: 'center' }}>
                  {/* 使用增强后的 formatDate */}
                  <p style={{ fontSize: '12px', fontWeight: 'bold' }}>{formatDate(photo.time)}</p>
                  <img src={`http://localhost:5000/${photo.path.replace(/\\/g, '/')}`} style={{ width: '150px' }} alt="p" />
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

export default App;