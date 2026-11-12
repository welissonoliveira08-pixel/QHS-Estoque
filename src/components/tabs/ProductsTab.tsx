import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import {
  Search,
  Plus,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  AlertTriangle,
  Camera,
  Upload,
  Image as ImageIcon,
  X,
  Layers,
  ZoomIn,
  Calendar,
} from 'lucide-react';

const PRESET_QHS_PHOTOS = [
  {
    name: 'Capacete de Proteção Refletivo',
    url: '/src/assets/images/prod_capacete_seguranca_1794501692013.jpg',
  },
  {
    name: 'Multímetro Digital True RMS',
    url: '/src/assets/images/prod_multimetro_digital_1794501691696.jpg',
  },
  {
    name: 'Chave de Impacto a Bateria',
    url: '/src/assets/images/prod_furadeira_impacto_1794501692755.jpg',
  },
  {
    name: 'Válvula / Extintor Equipamento',
    url: '/src/assets/images/prod_valvula_industrial_1794501692441.jpg',
  },
];

export const ProductsTab: React.FC = () => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    settings,
    updateSettings,
    setSelectedProductForModal,
    managedLists,
  } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('TODOS');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'stock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State (strictly the required fields only: code, name, group, currentStock, minStock, createdAt, photoUrl, description)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    group: managedLists.groups[0] || 'Materiais',
    currentStock: 0,
    minStock: 5,
    createdAt: '',
    photoUrl: '',
    description: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered & Sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesSearch =
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.group.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesGroup =
          selectedGroup === 'TODOS' || p.group === selectedGroup;

        const matchesStock = filterLowStockOnly
          ? p.currentStock <= p.minStock
          : true;

        return matchesSearch && matchesGroup && matchesStock;
      })
      .sort((a, b) => {
        let valA: string | number = a.name;
        let valB: string | number = b.name;

        if (sortBy === 'code') {
          valA = a.code;
          valB = b.code;
        } else if (sortBy === 'name') {
          valA = a.name;
          valB = b.name;
        } else if (sortBy === 'stock') {
          valA = a.currentStock;
          valB = b.currentStock;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [products, searchQuery, selectedGroup, filterLowStockOnly, sortBy, sortOrder]);

  const generateAutoCode = (groupName: string) => {
    let prefix = 'MAT';
    const gUpper = groupName.toUpperCase();
    if (gUpper.includes('EXTINTOR')) prefix = 'EXT';
    else if (gUpper.includes('PLACA')) prefix = 'PLA';
    else prefix = groupName.slice(0, 3).toUpperCase();

    const countSamePrefix = products.filter((p) => p.code.includes(`QHS-${prefix}`)).length;
    return `QHS-${prefix}-${String(countSamePrefix + 101).padStart(3, '0')}`;
  };

  const handleOpenAdd = () => {
    const initialGroup = managedLists.groups[0] || 'Materiais';
    const autoCode = generateAutoCode(initialGroup);
    const today = new Date().toISOString().split('T')[0];

    setEditingProduct(null);
    setFormData({
      code: autoCode,
      name: '',
      group: initialGroup,
      currentStock: 0,
      minStock: 5,
      createdAt: today,
      photoUrl: '',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleGroupChangeInForm = (newGroup: string) => {
    setFormData((prev) => ({
      ...prev,
      group: newGroup,
      // If adding new product and code hasn't been manually altered, update prefix
      code: editingProduct ? prev.code : generateAutoCode(newGroup),
    }));
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      code: product.code,
      name: product.name,
      group: product.group,
      currentStock: product.currentStock,
      minStock: product.minStock,
      createdAt: product.createdAt,
      photoUrl: product.photoUrl || '',
      description: product.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      return;
    }

    if (editingProduct) {
      updateProduct({
        ...editingProduct,
        code: formData.code,
        name: formData.name,
        group: formData.group,
        currentStock: Number(formData.currentStock),
        minStock: Number(formData.minStock),
        photoUrl: formData.photoUrl,
        description: formData.description,
      });
    } else {
      addProduct({
        code: formData.code,
        name: formData.name,
        group: formData.group,
        currentStock: Number(formData.currentStock),
        minStock: Number(formData.minStock),
        photoUrl: formData.photoUrl,
        description: formData.description,
      });
    }

    setIsModalOpen(false);
  };

  const handleDelete = (product: Product) => {
    if (
      window.confirm(
        `Confirma a exclusão do produto "${product.name}" (${product.code}) do catálogo?`
      )
    ) {
      deleteProduct(product.id);
    }
  };

  // Image Upload Handler with Canvas Downsampling
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = Math.min(img.width, MAX_WIDTH);
        canvas.height = img.width > MAX_WIDTH ? img.height * scaleSize : img.height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setFormData((prev) => ({ ...prev, photoUrl: dataUrl }));
        }
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
            Cadastro de Produtos
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Gerencie o catálogo de materiais, extintores e placas com controle de estoque e fotos opcionais.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick toggle for Photos */}
          <button
            onClick={() => updateSettings({ showProductPhotos: !settings.showProductPhotos })}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
              settings.showProductPhotos
                ? 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800'
                : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
            }`}
            title="Ativar ou desativar exibição de fotos nos produtos"
          >
            {settings.showProductPhotos ? (
              <>
                <Eye className="w-3.5 h-3.5 text-red-500" />
                <span>Fotos: <strong className="text-emerald-400">Ativado</strong></span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                <span>Fotos: <strong className="text-zinc-500">Desativado</strong></span>
              </>
            )}
          </button>

          {/* New Product Button */}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Produto
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código, nome ou grupo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 bg-zinc-50/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Group Filter (Dynamic from Managed Lists) */}
          <div>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-red-600 bg-white"
            >
              <option value="TODOS">Todos os Grupos</option>
              {managedLists.groups.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>

          {/* Low Stock Toggle Button */}
          <button
            onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
            className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              filterLowStockOnly
                ? 'bg-amber-500/10 border-amber-500 text-amber-700 font-semibold'
                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <AlertTriangle
              className={`w-3.5 h-3.5 ${
                filterLowStockOnly ? 'text-amber-600' : 'text-zinc-400'
              }`}
            />
            <span>Abaixo do Mínimo</span>
          </button>
        </div>

        {/* Results Info & Order */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs text-zinc-500">
          <div>
            <span>Exibindo </span>
            <strong className="text-zinc-800 font-mono tabular-nums">
              {filteredProducts.length}
            </strong>
            <span> de </span>
            <strong className="text-zinc-800 font-mono tabular-nums">
              {products.length}
            </strong>
            <span> produtos cadastrados</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400">Ordenar por:</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-') as [any, any];
                setSortBy(sb);
                setSortOrder(so);
              }}
              className="text-xs border border-zinc-200 rounded px-2 py-1 bg-white text-zinc-700"
            >
              <option value="name-asc">Nome (A - Z)</option>
              <option value="name-desc">Nome (Z - A)</option>
              <option value="code-asc">Código (Crescente)</option>
              <option value="stock-asc">Estoque (Menor primeiro)</option>
              <option value="stock-desc">Estoque (Maior primeiro)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table (Code, Name, Group, Current Stock, Min Stock, Photos) */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900 text-zinc-200 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                {/* Photo Column only rendered if showProductPhotos is true */}
                {settings.showProductPhotos && (
                  <th className="py-3.5 px-4 w-20 text-center">Foto</th>
                )}
                <th className="py-3.5 px-4">Código</th>
                <th className="py-3.5 px-4">Nome do Produto</th>
                <th className="py-3.5 px-4">Grupo</th>
                <th className="py-3.5 px-4 text-right">Estoque Atual</th>
                <th className="py-3.5 px-4 text-right">Estoque Mínimo</th>
                <th className="py-3.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={settings.showProductPhotos ? 7 : 6}
                    className="py-12 text-center text-zinc-400"
                  >
                    <Layers className="w-10 h-10 mx-auto text-zinc-300 stroke-1 mb-2" />
                    <p className="text-sm font-semibold text-zinc-600">
                      Nenhum produto encontrado
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Tente ajustar sua busca ou filtro de grupo.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isBelowMin = product.currentStock <= product.minStock;

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-zinc-50/80 transition-colors group"
                    >
                      {/* Photo Thumbnail */}
                      {settings.showProductPhotos && (
                        <td className="py-2.5 px-4 text-center">
                          {product.photoUrl ? (
                            <button
                              onClick={() => setSelectedProductForModal(product)}
                              className="relative w-12 h-12 rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100 mx-auto group/thumb block"
                              title="Clique para ver fotografia ampliada"
                            >
                              <img
                                src={product.photoUrl}
                                alt={product.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover transition-transform group-hover/thumb:scale-110"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <ZoomIn className="w-4 h-4" />
                              </div>
                            </button>
                          ) : (
                            <div
                              className="w-12 h-12 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 mx-auto flex flex-col items-center justify-center text-zinc-400"
                              title="Produto sem foto anexada"
                            >
                              <Camera className="w-4 h-4 text-zinc-300" />
                              <span className="text-[9px] text-zinc-400 font-medium">S/ Foto</span>
                            </div>
                          )}
                        </td>
                      )}

                      {/* Code */}
                      <td className="py-3 px-4 font-mono font-semibold text-zinc-900 whitespace-nowrap">
                        <span className="bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded border border-zinc-200 text-xs">
                          {product.code}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-semibold text-zinc-900 leading-snug">
                        {product.name}
                      </td>

                      {/* Group */}
                      <td className="py-3 px-4 text-zinc-600 whitespace-nowrap font-medium">
                        <span className="px-2 py-0.5 bg-zinc-100 rounded text-zinc-700">
                          {product.group}
                        </span>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div
                          className={`font-mono font-bold text-sm tabular-nums inline-flex items-center gap-1.5 ${
                            isBelowMin ? 'text-red-600' : 'text-zinc-900'
                          }`}
                        >
                          {isBelowMin && (
                            <span title="Estoque abaixo ou no limite mínimo!">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                            </span>
                          )}
                          <span>{product.currentStock} un</span>
                        </div>
                      </td>

                      {/* Min Stock */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-600 whitespace-nowrap">
                        {product.minStock} un
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {product.photoUrl && (
                            <button
                              onClick={() => setSelectedProductForModal(product)}
                              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
                              title="Ver detalhes e foto"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
                            title="Editar produto"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Excluir produto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Modal de Cadastro / Edição com SOMENTE os campos solicitados */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-zinc-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-900 text-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-red-600 rounded-full" />
                <h3 className="text-base font-bold text-white">
                  {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Código Automático */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Código do Produto (Automático) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 font-mono font-semibold"
                    placeholder="Ex: QHS-EXT-101"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">
                    Gerado automaticamente conforme o grupo selecionado.
                  </span>
                </div>

                {/* 2. Grupo (Materiais, Extintores, Placas ou gerenciados pelo admin) */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Grupo *
                  </label>
                  <select
                    value={formData.group}
                    onChange={(e) => handleGroupChangeInForm(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white font-medium"
                  >
                    {managedLists.groups.map((grp) => (
                      <option key={grp} value={grp}>
                        {grp}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">
                    Gerenciável na área de Configurações pelo Administrador.
                  </span>
                </div>

                {/* 3. Nome do Produto */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 font-medium"
                    placeholder="Ex: Extintor de Incêndio ABC 6 kg Pressurizado"
                  />
                </div>

                {/* 4. Estoque Atual */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Estoque Atual (Unidades) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.currentStock}
                    onChange={(e) =>
                      setFormData({ ...formData, currentStock: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 font-mono tabular-nums font-bold"
                  />
                </div>

                {/* 5. Estoque Mínimo */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Estoque Mínimo de Segurança *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.minStock}
                    onChange={(e) =>
                      setFormData({ ...formData, minStock: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 font-mono tabular-nums font-bold"
                  />
                </div>
              </div>

              {/* 6. Data do Cadastro */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs flex items-center justify-between">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  Data do Cadastro:
                </span>
                <span className="font-mono font-semibold text-zinc-800">
                  {formData.createdAt || new Date().toISOString().split('T')[0]}
                </span>
              </div>

              {/* Observação / Descrição Opcional */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Observações Técnicas (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600"
                  placeholder="Informações adicionais do item..."
                />
              </div>

              {/* 7. Fotografia Opcional do Produto */}
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-bold text-zinc-800">
                      Fotografia do Produto (Opcional)
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    O produto pode ser salvo com ou sem foto.
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Photo Preview */}
                  <div className="w-20 h-20 rounded-lg border border-zinc-300 bg-white flex items-center justify-center overflow-hidden shrink-0 relative group">
                    {formData.photoUrl ? (
                      <>
                        <img
                          src={formData.photoUrl}
                          alt="Preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, photoUrl: '' })}
                          className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs transition-opacity"
                          title="Remover foto"
                        >
                          Remover
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-2">
                        <ImageIcon className="w-5 h-5 text-zinc-300 mx-auto mb-1" />
                        <span className="text-[10px] text-zinc-400">Sem Foto</span>
                      </div>
                    )}
                  </div>

                  {/* Upload & Presets Actions */}
                  <div className="flex-1 w-full space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5 text-zinc-500" />
                        Fazer Upload de Imagem
                      </button>

                      {formData.photoUrl && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, photoUrl: '' })}
                          className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                        >
                          Limpar Foto
                        </button>
                      )}
                    </div>

                    <div className="pt-1">
                      <span className="text-[10px] text-zinc-500 block mb-1">
                        Ou selecione um modelo do acervo QHS:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_QHS_PHOTOS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setFormData({ ...formData, photoUrl: preset.url })}
                            className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                              formData.photoUrl === preset.url
                                ? 'bg-red-600 text-white border-red-600 font-semibold'
                                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                            }`}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  {editingProduct ? 'Salvar Alterações' : 'Concluir Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
