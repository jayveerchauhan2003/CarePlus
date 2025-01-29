import React, { useState, useEffect } from 'react';
import { Guitar as Hospital, MapPin, Phone, Clock, Navigation, Shield, Star, AlertCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface HospitalData {
  id: string;
  name: string;
  distance: number;
  address: string;
  phone: string;
  emergency: boolean;
  rating: number;
  specialties: string[];
  openNow: boolean;
  location: {
    lat: number;
    lng: number;
  };
}

// Component to recenter map when location changes
function RecenterMap({ location }: { location: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([location.lat, location.lng], 13);
  }, [location, map]);
  return null;
}

function App() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hospitals, setHospitals] = useState<HospitalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get user's location
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(userLocation);
          await fetchNearbyHospitals(userLocation);
          setLoading(false);
        },
        (error) => {
          setError('Please enable location services to find nearby hospitals');
          setLoading(false);
        }
      );
    } else {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
    }
  }, []);

  const fetchNearbyHospitals = async (userLocation: { lat: number; lng: number }) => {
    try {
      // Using OpenStreetMap's Overpass API to find hospitals
      const radius = 20000; // 20km in meters
      const query = `
        [out:json][timeout:25];
        (
          node["amenity"="hospital"](around:${radius},${userLocation.lat},${userLocation.lng});
          way["amenity"="hospital"](around:${radius},${userLocation.lat},${userLocation.lng});
          relation["amenity"="hospital"](around:${radius},${userLocation.lat},${userLocation.lng});
        );
        out body;
        >;
        out skel qt;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });

      const data = await response.json();
      
      const nearbyHospitals: HospitalData[] = data.elements
        .filter((element: any) => element.tags && element.tags.name)
        .map((element: any) => {
          const lat = element.lat || (element.center && element.center.lat);
          const lng = element.lon || (element.center && element.center.lon);
          
          // Calculate distance using Haversine formula
          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            lat,
            lng
          );

          return {
            id: element.id.toString(),
            name: element.tags.name,
            distance: parseFloat(distance.toFixed(1)),
            address: element.tags['addr:street'] || 'Address not available',
            phone: element.tags.phone || 'N/A',
            emergency: element.tags.emergency === 'yes',
            rating: 4.0, // Default rating since OSM doesn't provide ratings
            specialties: ['General Medicine'],
            openNow: true, // Default since OSM doesn't provide real-time opening hours
            location: {
              lat,
              lng
            }
          };
        })
        .filter((hospital: HospitalData) => hospital.location.lat && hospital.location.lng)
        .sort((a: HospitalData, b: HospitalData) => a.distance - b.distance)
        .slice(0, 10);

      setHospitals(nearbyHospitals);
    } catch (error) {
      console.error('Error fetching hospitals:', error);
      setError('Failed to fetch nearby hospitals. Please try again later.');
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (value: number): number => {
    return (value * Math.PI) / 180;
  };

  const handleGetDirections = (hospital: HospitalData) => {
    if (!location) return;
    
    const url = `https://www.openstreetmap.org/directions?from=${location.lat},${location.lng}&to=${hospital.location.lat},${hospital.location.lng}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Finding nearby hospitals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="h-screen flex flex-col">
        <header className="p-4 md:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Hospital className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-800">NearHospital</h1>
            </div>
            {location && (
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="h-4 w-4 mr-1" />
                <span>Using your current location</span>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 md:p-8">
          <div className="overflow-y-auto space-y-4 pr-4 max-h-[calc(100vh-12rem)]">
            {hospitals.map((hospital) => (
              <div
                key={hospital.id}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="text-xl font-semibold text-gray-800">
                          {hospital.name}
                        </h2>
                        {hospital.emergency && (
                          <Shield className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                      <div className="mt-2 flex items-center space-x-2">
                        <Star className="h-4 w-4 text-yellow-400" />
                        <span className="text-gray-600">{hospital.rating}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600">{hospital.distance} km away</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {hospital.openNow ? (
                        <span className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                          Open Now
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center text-gray-600">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{hospital.address}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Phone className="h-4 w-4 mr-2" />
                      <span>{hospital.phone}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex flex-wrap gap-2">
                      {hospital.specialties.map((specialty, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-end space-x-4">
                    <a
                      href={`tel:${hospital.phone}`}
                      className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      <span>Call</span>
                    </a>
                    <button
                      onClick={() => handleGetDirections(hospital)}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Navigation className="h-4 w-4 mr-1" />
                      <span>Get Directions</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="rounded-xl overflow-hidden shadow-lg h-[calc(100vh-12rem)]">
            {location && (
              <MapContainer
                center={[location.lat, location.lng]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <RecenterMap location={location} />
                <Marker position={[location.lat, location.lng]}>
                  <Popup>Your Location</Popup>
                </Marker>
                {hospitals.map((hospital) => (
                  <Marker
                    key={hospital.id}
                    position={[hospital.location.lat, hospital.location.lng]}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold">{hospital.name}</p>
                        <p>{hospital.distance} km away</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;