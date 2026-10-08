import React from 'react';
import { LayoutGrid, SlidersHorizontal, X, Download, ZoomIn, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { SharedImageItem } from '../types';

interface MediaGalleryModalProps {
  images: SharedImageItem[];
  onClose?: () => void;
  onSendNewPhoto?: () => void;
}

export const MediaGalleryModal: React.FC<MediaGalleryModalProps> = ({
  images,
  onClose,
  onSendNewPhoto,
}) => {
  const [viewMode, setViewMode] = React.useState<'grid' | 'slide'>('grid');
  const [activeImageIndex, setActiveImageIndex] = React.useState<number | null>(null);
  const [slideIndex, setSlideIndex] = React.useState(0);

  const selectedImage = activeImageIndex !== null ? images[activeImageIndex] : null;

  const nextSlide = () => {
    if (images.length === 0) return;
    setSlideIndex((prev) => (prev + 1) % images.length);
  };

  const prevSlide = () => {
    if (images.length === 0) return;
    setSlideIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header Controls */}
      <div className="flex items-center justify-between pb-3 border-b border-amber-100">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold text-stone-800">Visual Moments</h3>
          <span className="text-xs text-stone-500">({images.length})</span>
        </div>

        {/* View Switcher: Grid vs Slide */}
        <div className="flex items-center bg-stone-100/80 p-0.5 rounded-lg border border-stone-200/60">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'grid'
                ? 'bg-white text-stone-800 shadow-xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
            title="Grid View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('slide')}
            className={`p-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'slide'
                ? 'bg-white text-stone-800 shadow-xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
            title="Slide Carousel View"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body View */}
      {images.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center px-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/50 flex items-center justify-center text-2xl mb-2.5">
            🖼️
          </div>
          <p className="text-sm font-semibold text-stone-700">No images shared yet</p>
          <p className="text-xs text-stone-500 max-w-xs mt-1">
            During your voice call, you can share a photo or Jewfren can conjure comforting visuals for you.
          </p>
          {onSendNewPhoto && (
            <button
              onClick={onSendNewPhoto}
              className="mt-3.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              Share a Photo with Jewfren
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        // Grid View
        <div className="grid grid-cols-2 gap-2.5 py-3 overflow-y-auto max-h-72 pr-1">
          {images.map((img, idx) => (
            <div
              key={img.id}
              onClick={() => setActiveImageIndex(idx)}
              className="group relative rounded-xl overflow-hidden bg-stone-100 aspect-square border border-amber-100/70 shadow-xs hover:shadow-md cursor-pointer transition-all"
            >
              <img
                src={img.url}
                alt={img.title || 'Shared visual'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-white">
                <span className="text-[10px] font-medium truncate">{img.title || 'View photo'}</span>
                <span className="text-[9px] text-amber-200/90 capitalize">{img.sender}</span>
              </div>
              <span className="absolute top-1.5 left-1.5 text-[9px] bg-stone-900/60 backdrop-blur-xs text-white px-1.5 py-0.5 rounded font-medium">
                {img.sender === 'agent' ? 'Jewfren' : 'You'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        // Slide / Carousel View
        <div className="relative flex flex-col items-center justify-center py-3 flex-1">
          {images[slideIndex] && (
            <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden bg-stone-100 shadow-md border border-amber-100/80 group">
              <img
                src={images[slideIndex].url}
                alt={images[slideIndex].title || 'Current slide'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-transparent to-transparent flex flex-col justify-end p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white drop-shadow-sm">
                      {images[slideIndex].title || 'Comforting Visual'}
                    </h4>
                    <p className="text-xs text-amber-200/90 line-clamp-2 mt-0.5">
                      {images[slideIndex].caption || `Shared by ${images[slideIndex].sender === 'agent' ? 'Jewfren' : 'You'}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveImageIndex(slideIndex)}
                    className="p-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-white"
                    title="Fullscreen"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Slide Navigation Controls */}
          {images.length > 1 && (
            <div className="flex items-center justify-between w-full mt-3 px-2">
              <button
                onClick={prevSlide}
                className="p-1.5 bg-stone-100 hover:bg-stone-200 rounded-full text-stone-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlideIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === slideIndex ? 'w-5 bg-amber-500' : 'w-1.5 bg-stone-300'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={nextSlide}
                className="p-1.5 bg-stone-100 hover:bg-stone-200 rounded-full text-stone-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lightbox / Zoom Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveImageIndex(null)}
        >
          <div
            className="relative max-w-xl w-full bg-stone-900 rounded-3xl overflow-hidden shadow-2xl border border-stone-800 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-stone-800 text-white">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
                  {selectedImage.sender === 'agent' ? 'From Jewfren' : 'Sent by You'}
                </span>
                <span className="text-sm font-semibold">{selectedImage.title || 'Image Viewer'}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selectedImage.url}
                  download={`jewfren-${selectedImage.id}.jpg`}
                  className="p-1.5 text-stone-400 hover:text-white transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setActiveImageIndex(null)}
                  className="p-1.5 text-stone-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative bg-black flex items-center justify-center max-h-[65vh] overflow-hidden">
              <img
                src={selectedImage.url}
                alt={selectedImage.title || 'Full view'}
                className="max-h-[65vh] w-auto object-contain"
              />
            </div>

            {selectedImage.caption && (
              <div className="p-3.5 bg-stone-900/90 text-stone-300 text-xs border-t border-stone-800">
                {selectedImage.caption}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
