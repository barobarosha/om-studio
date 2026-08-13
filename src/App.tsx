import { Routes, Route } from "react-router";
import { Layout } from "@/components/Layout";
import Home from "@/pages/Home";
import CatalogPage from "@/pages/Catalog";
import ProductPage from "@/pages/Product";
import { BrandsPage, BrandPage, CollectionsPage } from "@/pages/Brands";
import { DeliveryPage, ContactsPage } from "@/pages/DeliveryContacts";
import { PrivacyPage, NotFoundPage } from "@/pages/Static";
import { AdminPage } from "@/pages/Admin";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/catalog/keramogranit" element={<CatalogPage forceCategory="keramogranit" />} />
        <Route path="/catalog/plitka" element={<CatalogPage forceCategory="plitka" />} />
        <Route path="/sale" element={<CatalogPage forceSale />} />
        <Route path="/search" element={<CatalogPage forceSearch />} />
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/brands" element={<BrandsPage />} />
        <Route path="/brands/:slug" element={<BrandPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/delivery" element={<DeliveryPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
