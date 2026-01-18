import React, { useState, useEffect } from 'react';

import { MapContainer, TileLayer, Marker, Popup ,Polyline} from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 修复图标
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function App() {
  const [photos, setPhotos] = useState([]);

  // 页面加载时：从数据库拉取历史数据
  useEffect(() => {
    axios.get('http://localhost:5000/photos')
      .then(res => {
        const dbPhotos = res.data.map(p => ({
          id: p.id,
          name: p.name,
          position: [p.lat, p.lng], // 数据库出来的坐标
          path: p.path
        }));
        setPhotos(dbPhotos);
      })
      .catch(err => console.error("连接数据库失败:", err));
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await axios.post('http://localhost:5000/upload', formData);
      if (res.data.success) {
        const p = res.data.data;
        setPhotos(prev => [...prev, {
          id: p.id,
          name: p.name,
          position: [p.lat, p.lng],
          path: p.path
        }]);
        alert("上传并入库成功！");
      }
    } catch (err) {
      alert("上传失败，请检查后端控制台报错");
    }
    
  };

  // 核心逻辑：提取轨迹数组
  // Polyline 需要的数据格式是：[[lat1, lng1], [lat2, lng2], ...]
  const trajectoryPath = photos.map(p => p.position);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px", background: "#eee" }}>
        <input type="file" onChange={handleUpload} accept="image/*" />
        <span style={{marginLeft: '10px', fontSize: '12px', color: '#666'}}>
           当前已有 {photos.length} 个轨迹点
        </span>
      </div>
      
      <MapContainer center={[35, 105]} zoom={4} style={{ flex: 1 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {/* 3. 渲染轨迹线 (放在 Marker 之前，作为底层图层) */}
        {photos.length > 1 && (
            <Polyline 
                positions={trajectoryPath} 
                pathOptions={{ color: 'blue', weight: 4, dashArray: '10, 10', opacity: 0.7 }} 
            />
        )}

        {photos.map(photo => (
          <Marker key={photo.id} position={photo.position}>
            <Popup>
              <div style={{textAlign: 'center'}}>
                <p>{photo.name}</p>
                <img 
                  src={`http://localhost:5000/${photo.path.replace(/\\/g, '/')}`} 
                  alt="preview" 
                  style={{width: '100px'}} 
                />
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default App;