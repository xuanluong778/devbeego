package vn.beego.app;

import android.app.Activity;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "BeegoPlayBilling")
public class BeegoPlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;
    private String pendingProductId;

    private synchronized BillingClient getClient() {
        if (billingClient == null) {
            billingClient = BillingClient.newBuilder(getContext())
                    .setListener(this)
                    .enablePendingPurchases()
                    .build();
        }
        return billingClient;
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null || productId.isEmpty()) {
            call.reject("productId required");
            return;
        }
        pendingPurchaseCall = call;
        pendingProductId = productId;

        BillingClient client = getClient();
        if (client.isReady()) {
            queryAndLaunch(productId);
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    rejectPending("Billing setup failed: " + billingResult.getResponseCode());
                    return;
                }
                queryAndLaunch(productId);
            }

            @Override
            public void onBillingServiceDisconnected() {
                rejectPending("Billing service disconnected");
            }
        });
    }

    private void queryAndLaunch(String productId) {
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.SUBS)
                .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(product))
                .build();

        getClient().queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK
                    || productDetailsList == null
                    || productDetailsList.isEmpty()) {
                rejectPending("Product not found in Play Console: " + productId);
                return;
            }
            ProductDetails details = productDetailsList.get(0);
            List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
            if (offers == null || offers.isEmpty()) {
                rejectPending("No subscription offer for: " + productId);
                return;
            }
            String offerToken = offers.get(0).getOfferToken();
            BillingFlowParams.ProductDetailsParams pdParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details)
                    .setOfferToken(offerToken)
                    .build();
            BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(pdParams))
                    .build();
            Activity activity = getActivity();
            if (activity == null) {
                rejectPending("No activity");
                return;
            }
            BillingResult launchResult = getClient().launchBillingFlow(activity, flowParams);
            if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                rejectPending("launchBillingFlow failed: " + launchResult.getResponseCode());
            }
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            rejectPending("User canceled");
            return;
        }
        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null) {
            rejectPending("Purchase failed: " + billingResult.getResponseCode());
            return;
        }
        for (Purchase purchase : purchases) {
            if (purchase.getProducts().contains(pendingProductId)) {
                if (!purchase.isAcknowledged()) {
                    AcknowledgePurchaseParams ack = AcknowledgePurchaseParams.newBuilder()
                            .setPurchaseToken(purchase.getPurchaseToken())
                            .build();
                    getClient().acknowledgePurchase(ack, br -> { /* best-effort */ });
                }
                resolvePending(purchase.getPurchaseToken(), pendingProductId);
                return;
            }
        }
        rejectPending("No matching purchase");
    }

    private void resolvePending(String purchaseToken, String productId) {
        PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;
        pendingProductId = null;
        if (call == null) return;
        JSObject ret = new JSObject();
        ret.put("purchaseToken", purchaseToken);
        ret.put("productId", productId);
        call.resolve(ret);
    }

    private void rejectPending(String message) {
        PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;
        pendingProductId = null;
        if (call != null) {
            call.reject(message);
        }
    }
}
